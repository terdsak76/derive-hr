import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { parseFinanceMonth } from '@/lib/finance';
import { parseKbizCsv, kbizReconciliationStatus, employeePaymentTypes } from '@/lib/kbiz';
import { kbizInvoices } from '@/lib/kbiz-invoices';
import { importKbizCsv } from '@/lib/kbiz-import';
import { matchExistingKbizEmployees } from '@/lib/kbiz-employees';
import { syncDocumentStatuses } from '@/lib/document-status';
import { syncVendorPaymentStatuses } from '@/lib/vendor-payment-status';
import { syncRevenueTaxStatuses } from '@/lib/revenue-tax-status';
import { vendorPaymentAmounts } from '@/lib/vendor-payments';
import { WithholdingConflict } from '@/lib/vendor-withholding';
import { syncIncentivePaymentStatuses } from '@/lib/incentive-payment-status';

class ValidationError extends Error {}
function errorResponse(error: unknown) {
  if (error instanceof WithholdingConflict) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error('Kbiz reconciliation failed:', error);
  return NextResponse.json({ error: 'Unable to save or load Kbiz reconciliation. Check the database migration and try again.' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const params = new URL(request.url).searchParams;
    const month = params.get('invoice_month') || '';
    if (!parseFinanceMonth(month)) throw new ValidationError('Select a valid invoice month');
    const [transactions, invoices, payments, employees, taxes] = await Promise.all([
      prisma.kbizTransaction.findMany({ include: { allocations: true, depositSuggestions: { where: { status: 'PENDING' } }, employeeAllocations: true, taxAllocations: { include: { taxPayment: { select: { paymentNumber: true, paymentMonth: true } } } }, vendorAllocations: { include: { vendorPayment: { select: { paymentNumber: true, vendorName: true } } } } }, orderBy: [{ transactionDate: 'desc' }, { transactionTime: 'desc' }, { balanceCents: 'desc' }] }),
      kbizInvoices(prisma, month),
      prisma.vendorPayment.findMany({ include: { allocations: { select: { amountCents: true } } }, orderBy: { paymentDate: 'desc' } }),
      prisma.employee.findMany({ select: { id: true, name: true, department: true }, orderBy: { name: 'asc' } }),
      prisma.revenueTaxPayment.findMany({ include: { vendorPayment: { select: { vendorName: true, taxId: true, paymentNumber: true } }, allocations: { select: { amountCents: true } } }, orderBy: { paymentMonth: 'desc' } }),
    ]);
    const vendorPayments = payments.map(({ allocations, ...payment }) => ({ ...payment, ...vendorPaymentAmounts(payment), allocatedCents: allocations.reduce((sum, item) => sum + item.amountCents, 0) }));
    const taxPayments = taxes.map(({ allocations, ...payment }) => ({ ...payment, allocatedCents: allocations.reduce((sum, item) => sum + item.amountCents, 0) }));
    return NextResponse.json({ transactions: transactions.map(row => ({ ...row, reconciliationStatus: kbizReconciliationStatus(row) })), invoices, vendorPayments, employees, taxPayments }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (body?.action === 'MATCH_EMPLOYEES') {
      if (!Array.isArray(body.transactionIds) || body.transactionIds.length > 25 ||
        body.transactionIds.some((id: unknown) => typeof id !== 'string' || !id.trim() || id.length > 254)) {
        throw new ValidationError('Provide up to 25 visible transaction IDs to match');
      }
      const transactionIds = [...new Set<string>(body.transactionIds)];
      if (!transactionIds.length) return NextResponse.json({ matched: 0, unmatched: 0 });
      const result = await prisma.$transaction(tx => matchExistingKbizEmployees(tx, user.id, transactionIds), { timeout: 60000 });
      return NextResponse.json(result);
    }
    if (typeof body?.csv !== 'string' || body.csv.length > 2_000_000 || typeof body?.filename !== 'string' || !body.filename.trim() || body.filename.length > 255) {
      throw new ValidationError('Select a CSV file smaller than 2 MB');
    }
    let rows;
    try { rows = parseKbizCsv(body.csv); } catch (error) { throw new ValidationError(error instanceof Error ? error.message : 'Invalid CSV'); }
    if (rows.length > 2000) throw new ValidationError('Import at most 2,000 transactions at a time');
    return NextResponse.json(await importKbizCsv(body.csv, body.filename, user.id));
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== 'string') throw new ValidationError('Select a transaction');
    await prisma.$transaction(async tx => {
      const row = await tx.kbizTransaction.findUnique({ where: { id: body.id } });
      if (!row) throw new ValidationError('Transaction not found');
      if (row.withdrawalCents > 0) {
        if (typeof body.expenseDescription !== 'string' || body.expenseDescription.length > 500) throw new ValidationError('Description must be at most 500 characters');
        if (body.allocations?.length) throw new ValidationError('Invoice payments must be matched to deposits');
        const previous = await tx.kbizVendorAllocation.findMany({ where: { transactionId: row.id } });
        const previousEmployees = await tx.kbizEmployeeAllocation.findMany({ where: { transactionId: row.id } });
        const previousTaxes = await tx.kbizTaxAllocation.findMany({ where: { transactionId: row.id } });
        const taxData: { taxPaymentId: string; amountCents: number }[] = [];
        if (body.taxAllocations !== undefined) {
          if (!Array.isArray(body.taxAllocations) || body.taxAllocations.length > 100) throw new ValidationError('Invalid tax payment allocations');
          const seenTaxes = new Set<string>();
          for (const allocation of body.taxAllocations) {
            if (!allocation || typeof allocation.taxPaymentId !== 'string' || seenTaxes.has(allocation.taxPaymentId) ||
              !Number.isSafeInteger(allocation.amountCents) || allocation.amountCents <= 0) throw new ValidationError('Select a tax payment with a positive amount; duplicates are not allowed');
            seenTaxes.add(allocation.taxPaymentId);
            const payment = await tx.revenueTaxPayment.findUnique({ where: { id: allocation.taxPaymentId } });
            if (!payment) throw new ValidationError('Tax payment not found');
            const elsewhere = await tx.kbizTaxAllocation.aggregate({ where: { taxPaymentId: payment.id, transactionId: { not: row.id } }, _sum: { amountCents: true } });
            if ((elsewhere._sum.amountCents || 0) + allocation.amountCents > payment.amountCents) throw new ValidationError('Allocation exceeds the remaining tax payment amount');
            taxData.push({ taxPaymentId: payment.id, amountCents: allocation.amountCents });
          }
          if (taxData.reduce((sum, item) => sum + item.amountCents, 0) > row.withdrawalCents) throw new ValidationError('Tax allocations exceed the withdrawal amount');
        }
        const employeeData: { employeeId: string; employeeName: string; paymentType: string; paymentMonth: string; amountCents: number }[] = [];
        if (body.employeeAllocations !== undefined) {
          if (!Array.isArray(body.employeeAllocations) || body.employeeAllocations.length > 200) throw new ValidationError('Invalid employee payment allocations');
          const seenEmployees = new Set<string>();
          for (const allocation of body.employeeAllocations) {
            if (!allocation || typeof allocation.employeeId !== 'string' || !employeePaymentTypes.some(type => type.value === allocation.paymentType) ||
              !parseFinanceMonth(allocation.paymentMonth) || !Number.isSafeInteger(allocation.amountCents) || allocation.amountCents <= 0) throw new ValidationError('Select an employee, Salary/Incentive/Onsite/Others, payment month and a positive amount');
            const key = `${allocation.employeeId}:${allocation.paymentType}:${allocation.paymentMonth}`;
            if (seenEmployees.has(key)) throw new ValidationError('Combine duplicate employee payments for the same type and month');
            seenEmployees.add(key);
            const employee = await tx.employee.findUnique({ where: { id: allocation.employeeId }, select: { id: true, name: true } });
            if (!employee) throw new ValidationError('Employee not found');
            if (allocation.paymentType === 'INCENTIVE') {
              const incentive = await tx.incentive.findUnique({ where: { employeeId_month: { employeeId: employee.id, month: allocation.paymentMonth } } });
              // Keep historical employee bank payments usable even when no monthly incentive entry exists.
              if (incentive) {
                if (incentive.status === 'INITIAL') throw new ValidationError('กรุณาอนุมัติ Incentive ของพนักงานในเดือนที่เลือกก่อนจับคู่ Kbiz');
                const elsewhere = await tx.kbizEmployeeAllocation.aggregate({ where: {
                  employeeId: employee.id, paymentMonth: allocation.paymentMonth, paymentType: 'INCENTIVE', transactionId: { not: row.id },
                }, _sum: { amountCents: true } });
                if ((elsewhere._sum.amountCents || 0) + allocation.amountCents > incentive.amountCents) throw new ValidationError('ยอดจับคู่เกินยอด Incentive คงเหลือของพนักงานในเดือนที่เลือก');
              }
            }
            employeeData.push({ employeeId: employee.id, employeeName: employee.name, paymentType: allocation.paymentType, paymentMonth: allocation.paymentMonth, amountCents: allocation.amountCents });
          }
          if (employeeData.reduce((sum, item) => sum + item.amountCents, 0) > row.withdrawalCents) throw new ValidationError('Employee allocations exceed the withdrawal amount');
        }
        if (body.expenseKind !== undefined && !['OTHER', 'VENDOR', 'EMPLOYEE'].includes(body.expenseKind)) throw new ValidationError('Invalid expense type');
        const finalEmployees = body.employeeAllocations !== undefined ? employeeData : previousEmployees;
        const finalVendors = body.vendorAllocations !== undefined ? body.vendorAllocations : previous;
        const finalTaxes = body.taxAllocations !== undefined ? taxData : previousTaxes;
        if (!Array.isArray(finalVendors)) throw new ValidationError('Invalid vendor payment allocations');
        if ([finalEmployees, finalVendors, finalTaxes].filter(items => items.length).length > 1) throw new ValidationError('Choose employee, vendor or Revenue Department payments for a withdrawal');
        const expenseKind = finalTaxes.length ? 'OTHER' : finalEmployees.length ? 'EMPLOYEE' : finalVendors.length ? 'VENDOR' : body.expenseKind || (body.employeeAllocations !== undefined || body.vendorAllocations === undefined ? row.expenseKind : 'OTHER');
        if (body.expenseKind && body.expenseKind !== expenseKind) throw new ValidationError('Expense type does not match the payment allocations');
        if (body.vendorAllocations !== undefined) {
          if (!Array.isArray(body.vendorAllocations) || body.vendorAllocations.length > 100) throw new ValidationError('Invalid vendor payment allocations');
          const seen = new Set<string>();
          let total = 0;
          for (const allocation of body.vendorAllocations) {
            if (!allocation || typeof allocation.vendorPaymentId !== 'string' || seen.has(allocation.vendorPaymentId) ||
              !Number.isSafeInteger(allocation.amountCents) || allocation.amountCents <= 0) throw new ValidationError('Each vendor payment must have a positive amount and may appear only once');
            seen.add(allocation.vendorPaymentId); total += allocation.amountCents;
            const payment = await tx.vendorPayment.findUnique({ where: { id: allocation.vendorPaymentId } });
            if (!payment || payment.status === 'INITIAL') throw new ValidationError('Print the vendor payment before reconciling it');
            const elsewhere = await tx.kbizVendorAllocation.aggregate({ where: { vendorPaymentId: payment.id, transactionId: { not: row.id } }, _sum: { amountCents: true } });
            if ((elsewhere._sum.amountCents || 0) + allocation.amountCents > vendorPaymentAmounts(payment).netCents) throw new ValidationError('Allocation exceeds the remaining net vendor payment after withholding');
          }
          if (total > row.withdrawalCents) throw new ValidationError('Vendor allocations exceed the withdrawal amount');
        }
        await tx.kbizTransaction.update({ where: { id: row.id }, data: { expenseDescription: body.expenseDescription.trim(), expenseKind, updatedById: user.id,
          ...(body.employeeAllocations !== undefined ? { employeeAllocations: { deleteMany: {}, create: employeeData } } : {}),
          ...(body.taxAllocations !== undefined ? { taxAllocations: { deleteMany: {}, create: taxData } } : {}),
          ...(body.vendorAllocations !== undefined ? { vendorAllocations: { deleteMany: {}, create: body.vendorAllocations.map((item: { vendorPaymentId: string; amountCents: number }) => ({ vendorPaymentId: item.vendorPaymentId, amountCents: item.amountCents })) } } : {}),
        } });
        if (body.vendorAllocations !== undefined) await syncVendorPaymentStatuses(tx, [...previous.map(item => item.vendorPaymentId), ...body.vendorAllocations.map((item: { vendorPaymentId: string }) => item.vendorPaymentId)]);
        if (body.taxAllocations !== undefined) await syncRevenueTaxStatuses(tx, [...previousTaxes.map(item => item.taxPaymentId), ...taxData.map(item => item.taxPaymentId)]);
        if (body.employeeAllocations !== undefined) await syncIncentivePaymentStatuses(tx,
          [...previousEmployees, ...employeeData].filter(item => item.paymentType === 'INCENTIVE').map(item => ({ employeeId: item.employeeId, month: item.paymentMonth })),
        );
        return;
      }
      if (body.vendorAllocations?.length) throw new ValidationError('Vendor payments must be matched to withdrawals');
      if (body.employeeAllocations?.length || body.expenseKind === 'EMPLOYEE') throw new ValidationError('Employee payments must be matched to withdrawals');
      if (body.taxAllocations?.length) throw new ValidationError('Revenue Department payments must be matched to withdrawals');
      if (!Array.isArray(body.allocations) || body.allocations.length > 100) throw new ValidationError('Invalid invoice allocations');
      const keys = new Set<string>();
      const data: { referenceKey: string; invoiceNumber: string; customer: string; amountCents: number; expectedCents: number; basis: string }[] = [];
      for (const allocation of body.allocations) {
        if (!allocation || typeof allocation.referenceKey !== 'string' || keys.has(allocation.referenceKey) ||
          !Number.isSafeInteger(allocation.amountCents) || allocation.amountCents <= 0 || !['NET', 'GROSS'].includes(allocation.basis)) {
          throw new ValidationError('Each invoice must have a positive amount and may only appear once');
        }
        keys.add(allocation.referenceKey);
        const month = row.transactionDate.slice(0, 7);
        const invoice = (await kbizInvoices(tx, month)).find(item => item.referenceKey === allocation.referenceKey);
        if (!invoice || invoice.status === 'INITIAL') throw new ValidationError('Print the invoice or receipt before reconciling it');
        const elsewhere = await tx.kbizAllocation.findMany({ where: { referenceKey: invoice.referenceKey, transactionId: { not: row.id } } });
        const expectedCents = allocation.basis === 'NET' ? invoice.netCents : invoice.grossCents;
        if (elsewhere.some(item => item.basis !== allocation.basis)) throw new ValidationError('Use the same withholding basis as the existing allocations for this invoice');
        if (elsewhere.reduce((sum, item) => sum + item.amountCents, 0) + allocation.amountCents > expectedCents) throw new ValidationError('Allocation exceeds the remaining invoice amount');
        data.push({ referenceKey: invoice.referenceKey, invoiceNumber: invoice.invoiceNumber, customer: invoice.customer,
          amountCents: allocation.amountCents, expectedCents, basis: allocation.basis });
      }
      if (data.reduce((sum, item) => sum + item.amountCents, 0) > row.depositCents) throw new ValidationError('Allocations exceed the deposit amount');
      const previous = await tx.kbizAllocation.findMany({ where: { transactionId: row.id }, select: { referenceKey: true } });
      await tx.kbizTransaction.update({ where: { id: row.id }, data: {
        updatedById: user.id, allocations: { deleteMany: {}, create: data },
      } });
      // Saving a manual decision supersedes any unconfirmed automatic proposal.
      await tx.kbizDepositSuggestion.updateMany({ where: { transactionId: row.id, status: 'PENDING' }, data: {
        status: 'REJECTED', reviewedById: user.id, reviewedAt: new Date(),
      } });
      await syncDocumentStatuses(tx, [...previous.map(item => item.referenceKey), ...data.map(item => item.referenceKey)]);
    }, { timeout: 30000 });
    return NextResponse.json({ saved: true });
  } catch (error) { return errorResponse(error); }
}
