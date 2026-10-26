import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyBonusPaymentStatusMigration(client) {
  const tx = await client.transaction('write');
  try {
    const bonus = await tx.execute('PRAGMA table_info("Bonus")');
    const allocations = await tx.execute('PRAGMA table_info("KbizEmployeeAllocation")');
    if (!bonus.rows.length || !allocations.rows.length) throw new Error('Install bonuses and employee reconciliation first');
    const schema = await tx.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'KbizEmployeeAllocation'");
    const fieldsReady = ['status', 'paymentDate', 'approvedById', 'approvedAt'].every(name => bonus.rows.some(column => column.name === name));
    const allocationReady = allocations.rows.some(column => column.name === 'bonusId') && String(schema.rows[0].sql).includes("'BONUS'");
    if (fieldsReady && allocationReady) { await tx.commit(); return 'already-applied'; }
    const sql = await readFile(new URL('../prisma/migrations/20261026140000_add_bonus_payment_status/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      const change = /^ALTER TABLE "(Bonus|KbizEmployeeAllocation)" ADD COLUMN "([^"]+)"/.exec(statement);
      if (change) {
        const columns = change[1] === 'Bonus' ? bonus : allocations;
        if (!columns.rows.some(column => column.name === change[2])) await tx.execute(statement);
      } else if (!allocationReady) await tx.execute(statement);
    }
    await tx.commit(); return 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Bonus payment status migration: ${await applyBonusPaymentStatusMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate bonus payment status:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
