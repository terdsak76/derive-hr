import type { Prisma } from '@prisma/client';
import { vendorPaymentAmounts } from './vendor-payments';
import { syncRevenueTaxStatuses } from './revenue-tax-status';

export class WithholdingConflict extends Error {}

/** Recognize withholding as vendor cash payments are reconciled. Cumulative
 * rounding makes split payments add up to exactly the full withholding amount. */
export async function syncVendorWithholding(db: Prisma.TransactionClient, vendorPaymentId: string) {
  const payment = await db.vendorPayment.findUniqueOrThrow({ where: { id: vendorPaymentId }, include: {
    allocations: { include: { transaction: { select: { transactionDate: true, transactionTime: true } } } },
    withholdingPayables: { include: { allocations: { select: { amountCents: true } } } },
  } });
  const { withholdingCents, netCents } = vendorPaymentAmounts(payment);
  const monthly = new Map<string, number>();
  let paid = 0, recognized = 0;
  for (const allocation of payment.allocations.sort((a, b) => a.transaction.transactionDate.localeCompare(b.transaction.transactionDate) || a.transaction.transactionTime.localeCompare(b.transaction.transactionTime) || a.transactionId.localeCompare(b.transactionId))) {
    paid += allocation.amountCents;
    if (paid > netCents) throw new WithholdingConflict('Vendor matches exceed the net payment after withholding');
    if (!withholdingCents) continue;
    const target = Number((BigInt(withholdingCents) * BigInt(paid) + BigInt(Math.floor(netCents / 2))) / BigInt(netCents));
    const month = allocation.transaction.transactionDate.slice(0, 7);
    monthly.set(month, (monthly.get(month) || 0) + target - recognized); recognized = target;
  }
  for (const payable of payment.withholdingPayables) {
    const amount = monthly.get(payable.paymentMonth) || 0;
    const remitted = payable.allocations.reduce((sum, item) => sum + item.amountCents, 0);
    if (remitted > amount) throw new WithholdingConflict('This withholding has already been matched to a Revenue Department payment. Remove or adjust that tax match before reducing or moving the vendor payment.');
    if (!amount) await db.revenueTaxPayment.delete({ where: { id: payable.id } });
    else {
      await db.revenueTaxPayment.update({ where: { id: payable.id }, data: { amountCents: amount } });
      await syncRevenueTaxStatuses(db, [payable.id]);
    }
    monthly.delete(payable.paymentMonth);
  }
  for (const [paymentMonth, amountCents] of monthly) if (amountCents > 0) {
    await db.revenueTaxPayment.create({ data: { vendorPaymentId: payment.id, paymentMonth, amountCents,
      paymentNumber: `WHT-${payment.paymentNumber}-${paymentMonth}`, updatedById: payment.updatedById,
    } });
  }
}
