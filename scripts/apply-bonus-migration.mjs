import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyBonusMigration(client) {
  const tx = await client.transaction('write');
  try {
    const existing = await tx.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('BonusYear', 'Bonus')");
    if (existing.rows.length === 2) {
      for (const [table, expected] of Object.entries({ BonusYear: ['year', 'maxLeaveDays', 'expenseMonth', 'updatedById', 'createdAt', 'updatedAt'],
        Bonus: ['id', 'employeeId', 'year', 'score', 'salaryCents', 'leaveDays', 'maxLeaveDays', 'baseCents', 'deductionCents', 'amountCents', 'createdAt', 'updatedAt'] })) {
        const columns = await tx.execute(`PRAGMA table_info("${table}")`);
        if (!expected.every(name => columns.rows.some(column => column.name === name))) throw new Error('Incompatible bonus schema');
      }
      await tx.commit();
      return 'already-applied';
    }
    if (existing.rows.length) throw new Error('Partial bonus schema found; review before applying');
    const employee = await tx.execute('PRAGMA table_info("Employee")');
    if (!employee.rows.length) throw new Error('Install Employee first');
    const sql = await readFile(new URL('../prisma/migrations/20261026130000_add_employee_bonuses/migration.sql', import.meta.url), 'utf8');
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
  try { console.log(`Bonus migration: ${await applyBonusMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate bonuses:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
