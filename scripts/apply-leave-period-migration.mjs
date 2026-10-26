import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyLeavePeriodMigration(client) {
  const tx = await client.transaction('write');
  try {
    const columns = await tx.execute('PRAGMA table_info("Leave")');
    if (!columns.rows.length) throw new Error('Leave table must be installed first');
    if (columns.rows.some(column => column.name === 'period')) {
      await tx.commit();
      return 'already-applied';
    }
    const sql = await readFile(new URL('../prisma/migrations/20261026090000_add_leave_period/migration.sql', import.meta.url), 'utf8');
    await tx.execute(sql);
    await tx.commit();
    return 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Leave period migration: ${await applyLeavePeriodMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate leave period:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
