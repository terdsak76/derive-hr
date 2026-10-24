import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { documentDetails } from '../src/lib/document-details';
import { syncDocumentStatuses } from '../src/lib/document-status';
import { syncVendorPaymentStatuses } from '../src/lib/vendor-payment-status';
import { kbizReconciliationStatus } from '../src/lib/kbiz';
import { syncRevenueTaxStatuses } from '../src/lib/revenue-tax-status';

async function main() {
  const documents = await prisma.issuedDocument.findMany();
  let updated = 0, unresolved = 0;
  for (const document of documents) {
    await prisma.$transaction(async tx => {
      if (document.netCents === null || document.grossCents === null) {
        const details = await documentDetails(tx, document.sourceType, document.referenceKey);
        if (details) { await tx.issuedDocument.update({ where: { id: document.id }, data: details }); updated++; }
        else unresolved++;
      }
      await syncDocumentStatuses(tx, [document.referenceKey]);
    }, { timeout: 30000 });
  }
  const vendorPayments = await prisma.vendorPayment.findMany({ where: { status: { not: 'INITIAL' } }, select: { id: true } });
  for (const payment of vendorPayments) await prisma.$transaction(tx => syncVendorPaymentStatuses(tx, [payment.id]));
  console.log(`Updated ${updated} document snapshots; ${unresolved} missing source records. Recalculated invoice and ${vendorPayments.length} vendor payment reconciliation statuses.`);
  const taxPayments = await prisma.revenueTaxPayment.findMany({ select: { id: true } });
  for (const payment of taxPayments) await prisma.$transaction(tx => syncRevenueTaxStatuses(tx, [payment.id]));
  console.log(`Recalculated ${taxPayments.length} Revenue Department tax payment statuses.`);
  const employeeTransactions = await prisma.kbizTransaction.findMany({ where: { expenseKind: 'EMPLOYEE' }, include: { allocations: true, taxAllocations: { include: { taxPayment: { select: { paymentNumber: true, paymentMonth: true } } } }, vendorAllocations: { include: { vendorPayment: { select: { paymentNumber: true, vendorName: true } } } }, employeeAllocations: true } });
  // Bank transaction status is derived from current allocations, including employee
  // payroll and incentives; there is no separate completion flag to go stale.
  console.log(`Employee payments: ${employeeTransactions.filter(row => kbizReconciliationStatus(row) === 'COMPLETED').length} completed of ${employeeTransactions.length} transactions.`);
}
void main().catch(() => { console.error('Unable to backfill document statuses.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
