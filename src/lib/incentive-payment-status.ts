import type { Prisma } from '@prisma/client';

type IncentiveKey = { employeeId: string; month: string };

/** Recompute from confirmed bank withdrawals; reversing a match reopens the approved incentive. */
export async function syncIncentivePaymentStatuses(db: Prisma.TransactionClient, keys: IncentiveKey[]) {
  const unique = new Map(keys.map(key => [`${key.employeeId}:${key.month}`, key]));
  for (const key of unique.values()) {
    const incentive = await db.incentive.findUnique({ where: { employeeId_month: key } });
    if (!incentive || incentive.status === 'INITIAL') continue;
    const payments = await db.kbizEmployeeAllocation.findMany({ where: {
      employeeId: key.employeeId, paymentMonth: key.month, paymentType: 'INCENTIVE',
      transaction: { withdrawalCents: { gt: 0 }, depositCents: 0 },
    }, select: { amountCents: true, transaction: { select: { transactionDate: true } } } });
    const total = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const dates = payments.map(payment => payment.transaction.transactionDate).sort();
    await db.incentive.update({ where: { id: incentive.id }, data: {
      status: incentive.amountCents > 0 && total >= incentive.amountCents ? 'COMPLETED' : 'PAYMENT_PENDING',
      paymentDate: dates.at(-1) || null,
    } });
  }
}
