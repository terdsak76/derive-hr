import type { Prisma } from '@prisma/client';
import { vendorPaymentAmounts } from './vendor-payments';
import { syncVendorWithholding } from './vendor-withholding';

export async function syncVendorPaymentStatuses(db: Prisma.TransactionClient, ids: string[]) {
  for (const id of new Set(ids)) {
    const payment = await db.vendorPayment.findUnique({ where: { id }, include: { allocations: { select: { amountCents: true } } } });
    if (!payment || payment.status === 'INITIAL') continue;
    const total = payment.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
    await db.vendorPayment.update({ where: { id }, data: { status: total >= vendorPaymentAmounts(payment).netCents ? 'COMPLETED' : 'PRINTED' } });
    await syncVendorWithholding(db, id);
  }
}
