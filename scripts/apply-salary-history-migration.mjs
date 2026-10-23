import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applySalaryHistoryMigration(client) {
  const transaction = await client.transaction('write');
  try {
    const sql = await readFile(new URL('../prisma/migrations/20261023040000_add_salary_incentive_history/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await transaction.execute(statement);
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
  finally { transaction.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    await import('dotenv/config');
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing database configuration');
    const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    try {
      await applySalaryHistoryMigration(client);
      console.log('Salary/incentive history is ready. Existing employee amounts and monthly incentives preserved.');
    } finally { client.close(); }
  })().catch(() => { console.error('Unable to apply salary history migration. Check database configuration and connectivity.'); process.exitCode = 1; });
}
