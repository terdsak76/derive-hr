import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

// Add only the Incentive table; do not replay migrations against existing Turso data.
export async function applyIncentiveMigration(client) {
  const transaction = await client.transaction('write');
  try {
    const existing = await transaction.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Incentive'");
    if (existing.rows.length) {
      const columns = await transaction.execute('PRAGMA table_info("Incentive")');
      const expected = ['id', 'employeeId', 'month', 'score', 'amountCents', 'createdAt', 'updatedAt'];
      if (!expected.every(name => columns.rows.some(column => column.name === name))) {
        throw new Error('Existing Incentive table has an incompatible schema.');
      }
      await transaction.commit();
      return 'already-applied';
    }
    const employee = await transaction.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Employee'");
    if (!employee.rows.length) throw new Error('Employee table must exist before this migration.');
    const sql = await readFile(new URL('../prisma/migrations/20261023000000_add_monthly_incentives/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      await transaction.execute(statement);
    }
    await transaction.commit();
    return 'applied';
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
}

async function main() {
  await import('dotenv/config');
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('Turso configuration is missing.');
  const client = createClient({ url, authToken });
  try {
    const result = await applyIncentiveMigration(client);
    console.log(result === 'applied' ? 'Incentive table and indexes added. Existing data preserved.' : 'Incentive table is already available.');
  } catch {
    console.error('Unable to apply the incentive migration. Check database connectivity and schema.');
    process.exitCode = 1;
  } finally { client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => { console.error('Turso configuration is missing or invalid.'); process.exitCode = 1; });
}
