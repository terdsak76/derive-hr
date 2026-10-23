import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireFinanceAdmin } from '@/lib/finance-access';
import { amountToCents, isInvoiceScheduled, parseFinanceMonth } from '@/lib/finance';
import { socialSecurityCents, taxDateText, validTaxAmount, vatSettlement, type TaxMonthSummary, type TaxReport } from '@/lib/taxes';

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const params = new URL(request.url).searchParams;
    const month = parseFinanceMonth(params.get('month'));
    const invoiceMonth = parseFinanceMonth(params.get('invoice_month') || params.get('month'));
    if (!month || !invoiceMonth) return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    const yearEndKey = `${month.year}-12`;
    const [employees, sales, purchases, settings, schedules, projects, issued] = await Promise.all([
      prisma.employee.findMany({ select: { id: true, name: true, isOwner: true, monthlySalaryCents: true, createdAt: true }, orderBy: { name: 'asc' } }),
      prisma.vatSale.findMany({ orderBy: [{ taxDate: 'asc' }, { id: 'asc' }] }),
      prisma.vatPurchase.findMany({ where: { month: { lte: yearEndKey } }, orderBy: [{ purchaseDate: 'asc' }, { id: 'asc' }] }),
      prisma.vatMonth.findMany({ where: { month: { lte: yearEndKey } } }),
      prisma.invoiceSchedule.findMany({ orderBy: { name: 'asc' } }),
      prisma.projectInvoice.findMany({ where: { invoiceDate: { gte: invoiceMonth.start, lt: invoiceMonth.end } }, include: { project: { select: { clientName: true } } }, orderBy: { invoiceDate: 'asc' } }),
      prisma.issuedDocument.findMany({ where: { documentType: 'INVOICE' }, select: { referenceKey: true, sourceType: true, documentNumber: true } }),
    ]);
    // Carry credits through earlier years and honor months already marked for refund.
    const firstKey = [`${month.year}-01`, ...sales.map(item => taxDateText(item.taxDate).slice(0, 7)), ...purchases.map(item => item.month), ...settings.map(item => item.month)].sort()[0];
    const first = parseFinanceMonth(firstKey)!;
    const monthly: TaxMonthSummary[] = [];
    let carry = 0;
    for (let index = first.year * 12 + first.month - 1; index <= month.year * 12 + 11; index += 1) {
      const key = `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
      const period = parseFinanceMonth(key)!;
      const records = sales.filter(item => item.taxDate >= period.start && item.taxDate < period.end);
      const output = records.reduce((sum, item) => sum + item.vatCents, 0);
      const input = purchases.filter(item => item.month === key && item.creditable).reduce((sum, item) => sum + item.vatCents, 0);
      const setting = settings.find(item => item.month === key);
      const opening = setting?.openingCreditCents || 0;
      const action = setting?.creditAction || 'CARRY';
      const settlement = vatSettlement(output, input, carry, opening, action);
      const socialSecurity = employees.filter(employee => employee.createdAt < period.end).reduce((sum, employee) => sum + socialSecurityCents(employee.monthlySalaryCents, employee.isOwner), 0);
      if (period.year === month.year) monthly.push({
        month: key, sales: records.reduce((sum, item) => sum + item.amountCents, 0) / 100,
        outputVat: output / 100, inputVat: input / 100, broughtForward: carry / 100, openingCredit: opening / 100, creditAction: action,
        payable: settlement.payable / 100, carryForward: settlement.carryForward / 100, refundRequested: settlement.refundRequested / 100,
        employerSocialSecurity: socialSecurity / 100, employeeSocialSecurity: socialSecurity / 100, totalSocialSecurity: socialSecurity * 2 / 100,
      });
      carry = settlement.carryForward;
    }
    const numbers = new Map(issued.map(item => [`${item.sourceType}:${item.referenceKey}`, item.documentNumber]));
    const recorded = new Set(sales.map(item => item.referenceKey));
    const invoices: TaxReport['invoices'] = [
      ...schedules.filter(item => isInvoiceScheduled(item.period, item.issueMonth, invoiceMonth.month)).map(item => {
        const referenceKey = `recurring:${item.id}:${invoiceMonth.key}`;
        return { referenceKey, sourceType: 'RECURRING', sourceId: item.id, invoiceMonth: invoiceMonth.key, invoiceNumber: numbers.get(`RECURRING:${referenceKey}`) || '',
          customer: item.name, description: item.description, amount: item.amount, recorded: recorded.has(referenceKey) };
      }),
      ...projects.map(item => ({ referenceKey: `project:${item.id}`, sourceType: 'PROJECT', sourceId: item.id, invoiceMonth: invoiceMonth.key,
        invoiceNumber: numbers.get(`PROJECT:project:${item.id}`) || item.invoiceNumber, customer: item.project.clientName, description: item.billingDescription, amount: item.amount, recorded: recorded.has(`project:${item.id}`) })),
    ];
    const report: TaxReport = {
      month: month.key, monthly, summary: monthly.find(item => item.month === month.key)!, invoices,
      employees: employees.filter(employee => employee.createdAt < month.end).map(employee => {
        const contribution = socialSecurityCents(employee.monthlySalaryCents, employee.isOwner) / 100;
        return { id: employee.id, name: employee.name, isOwner: employee.isOwner, salary: employee.monthlySalaryCents === null ? null : employee.monthlySalaryCents / 100, employer: contribution, employee: contribution, total: contribution * 2 };
      }),
      sales: sales.filter(item => item.taxDate >= month.start && item.taxDate < month.end).map(item => ({
        id: item.id, referenceKey: item.referenceKey, invoiceNumber: item.invoiceNumber, customer: item.customer, description: item.description,
        taxDate: taxDateText(item.taxDate), amount: item.amountCents / 100, vat: item.vatCents / 100,
      })),
      purchases: purchases.filter(item => item.month === month.key).map(item => ({
        id: item.id, month: item.month, purchaseDate: taxDateText(item.purchaseDate), supplier: item.supplier, invoiceNumber: item.invoiceNumber,
        description: item.description, amount: item.amountCents / 100, vat: item.vatCents / 100, creditable: item.creditable, expense: item.expense, vatMode: item.vatMode,
      })),
    };
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to load tax report:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลประกันสังคมและ VAT ได้' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFinanceAdmin(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => null);
    const month = parseFinanceMonth(body?.month);
    if (!month || !validTaxAmount(body?.opening_credit) || !['CARRY', 'REFUND'].includes(body?.credit_action)) {
      return NextResponse.json({ error: 'กรุณาระบุเดือน เครดิต และวิธีจัดการเครดิตให้ถูกต้อง' }, { status: 400 });
    }
    const data = { openingCreditCents: amountToCents(body.opening_credit), creditAction: body.credit_action as string };
    await prisma.vatMonth.upsert({ where: { month: month.key }, create: { month: month.key, ...data }, update: data });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error('Failed to save VAT settings:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกการจัดการเครดิตได้' }, { status: 500 });
  }
}
