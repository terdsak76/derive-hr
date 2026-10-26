import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyKbizDepositSuggestionsMigration(client) {
  const tx = await client.transaction('write');
  try {
    const parent = await tx.execute('PRAGMA table_info("KbizTransaction")');
    if (!parent.rows.length) throw new Error('Install Kbiz reconciliation first');
    const columns = await tx.execute('PRAGMA table_info("KbizDepositSuggestion")');
    if (columns.rows.length) {
      const expected = ['id', 'transactionId', 'referenceKey', 'invoiceNumber', 'invoiceMonth', 'customer', 'amountCents', 'expectedCents', 'basis', 'reason', 'status', 'createdById', 'reviewedById', 'reviewedAt', 'createdAt'];
      if (!expected.every(name => columns.rows.some(column => column.name === name))) throw new Error('Incompatible deposit suggestions schema');
      await tx.commit();
      return 'already-applied';
    }
    const sql = await readFile(new URL('../prisma/migrations/20261026100000_add_kbiz_deposit_suggestions/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await tx.execute(statement);
    await tx.commit();
    return 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Kbiz deposit suggestions migration: ${await applyKbizDepositSuggestionsMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate deposit suggestions:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
