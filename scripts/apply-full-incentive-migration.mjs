import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyFullIncentiveMigration(client) {
  const transaction = await client.transaction('write');
  try {
    const columns = await transaction.execute('PRAGMA table_info("Employee")');
    if (!columns.rows.length) throw new Error('Employee table must exist.');
    const exists = columns.rows.some(column => column.name === 'fullIncentiveCents');
    if (!exists) {
      const sql = await readFile(new URL('../prisma/migrations/20261023030000_add_full_incentive/migration.sql', import.meta.url), 'utf8');
      await transaction.execute(sql);
    }
    await transaction.commit();
    return exists ? 'already-applied' : 'applied';
  } catch (error) { await transaction.rollback(); throw error; }
  finally { transaction.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing database configuration.');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const result = await applyFullIncentiveMigration(client);
    console.log(result === 'applied' ? 'Full incentive column added. Existing employees default to zero; saved monthly incentives are preserved.' : 'Full incentive column is already available.');
  } finally { client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => { console.error('Unable to add full incentive. Check database configuration and connectivity.'); process.exitCode = 1; });
}
