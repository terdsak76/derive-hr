import type { Prisma } from '@prisma/client';

/** Only full payment completes a printed document; removing a match reopens it. */
export async function syncDocumentStatuses(db: Prisma.TransactionClient, referenceKeys: string[]) {
  for (const referenceKey of new Set(referenceKeys)) {
    const allocations = await db.kbizAllocation.findMany({ where: { referenceKey } });
    const total = allocations.reduce((sum, item) => sum + item.amountCents, 0);
    const expected = allocations[0]?.expectedCents;
    await db.issuedDocument.updateMany({
      where: { referenceKey, status: { not: 'INITIAL' } },
      data: { status: expected > 0 && total >= expected ? 'COMPLETED' : 'ISSUED' },
    });
  }
}
