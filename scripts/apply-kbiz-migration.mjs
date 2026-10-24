import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyKbizMigration(client) {
  const transaction = await client.transaction('write');
  try {
    const existing = await transaction.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('KbizTransaction', 'KbizAllocation')");
    if (existing.rows.length === 2) {
      for (const [table, expected] of Object.entries({
        KbizTransaction: ['id', 'fingerprint', 'accountNumber', 'transactionDate', 'transactionTime', 'bankDescription', 'channel', 'details', 'withdrawalCents', 'depositCents', 'balanceCents', 'sourceFile', 'expenseDescription', 'updatedById', 'createdAt', 'updatedAt'],
        KbizAllocation: ['id', 'transactionId', 'referenceKey', 'invoiceNumber', 'customer', 'amountCents', 'expectedCents', 'basis'],
      })) {
        const columns = await transaction.execute(`PRAGMA table_info("${table}")`);
        if (!expected.every(name => columns.rows.some(column => column.name === name))) throw new Error('Incompatible Kbiz schema');
      }
      await transaction.commit(); return 'already-applied';
    }
    if (existing.rows.length) throw new Error('Partial Kbiz schema found; review before applying');
    const sql = await readFile(new URL('../prisma/migrations/20261024080000_add_kbiz_reconciliation/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await transaction.execute(statement);
    await transaction.commit(); return 'applied';
  } catch (error) { await transaction.rollback(); throw error; }
  finally { transaction.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Kbiz database migration: ${await applyKbizMigration(client)}`); }
  catch { console.error('Unable to apply Kbiz migration. Check connectivity and schema.'); process.exitCode = 1; }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => { console.error('Turso configuration is missing or invalid.'); process.exitCode = 1; });
}
