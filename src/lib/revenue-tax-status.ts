import type { Prisma } from '@prisma/client';

export async function syncRevenueTaxStatuses(db: Prisma.TransactionClient, ids: string[]) {
  for (const id of new Set(ids)) {
    const payment = await db.revenueTaxPayment.findUnique({ where: { id }, include: { allocations: { select: { amountCents: true } } } });
    if (!payment) continue;
    const total = payment.allocations.reduce((sum, item) => sum + item.amountCents, 0);
    await db.revenueTaxPayment.update({ where: { id }, data: { status: total >= payment.amountCents ? 'COMPLETED' : total > 0 ? 'PARTIAL' : 'INITIAL' } });
  }
}
