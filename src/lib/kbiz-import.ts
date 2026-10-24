import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { parseKbizCsv } from './kbiz';

export async function importKbizCsv(csv: string, filename: string, updatedById?: string) {
  const rows = parseKbizCsv(csv);
  if (rows.length > 2000) throw new Error('Import at most 2,000 transactions at a time');
  const imported = await prisma.$transaction(async tx => {
    let count = 0;
    for (const row of rows) {
      // Balance distinguishes otherwise identical transfers. Ignore the filename
      // so renamed files and overlapping statement periods remain duplicate-safe.
      const fingerprint = createHash('sha256').update(JSON.stringify([
        row.accountNumber, row.transactionDate, row.transactionTime, row.withdrawalCents, row.depositCents, row.balanceCents,
      ])).digest('hex');
      if (await tx.kbizTransaction.findUnique({ where: { fingerprint }, select: { id: true } })) continue;
      await tx.kbizTransaction.create({ data: { ...row, fingerprint, sourceFile: filename, updatedById } });
      count++;
    }
    return count;
  }, { timeout: 60000 });
  return { imported, skipped: rows.length - imported };
}
