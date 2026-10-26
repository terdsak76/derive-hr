import type { Prisma } from '@prisma/client';

export async function syncBonusPaymentStatuses(db: Prisma.TransactionClient, bonusIds: string[]) {
  for (const id of new Set(bonusIds)) {
    const bonus = await db.bonus.findUnique({ where: { id } });
    if (!bonus || bonus.status === 'INITIAL') continue;
    const payments = await db.kbizEmployeeAllocation.findMany({ where: { bonusId: id, paymentType: 'BONUS',
      transaction: { withdrawalCents: { gt: 0 }, depositCents: 0 } },
      select: { amountCents: true, transaction: { select: { transactionDate: true } } } });
    const total = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    await db.bonus.update({ where: { id }, data: {
      status: bonus.amountCents > 0 && total >= bonus.amountCents ? 'COMPLETED' : 'PAYMENT_PENDING',
      paymentDate: payments.map(payment => payment.transaction.transactionDate).sort().at(-1) || null,
    } });
  }
}
