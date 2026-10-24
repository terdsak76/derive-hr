import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyEmployeeReconciliationMigration(client) {
  const tx = await client.transaction('write');
  try {
    const columns = await tx.execute('PRAGMA table_info("KbizTransaction")');
    if (!columns.rows.length) throw new Error('Kbiz transaction tables must be installed first');
    const hasKind = columns.rows.some(column => column.name === 'expenseKind');
    const existing = await tx.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='KbizEmployeeAllocation'");
    if (existing.rows.length && hasKind) {
      const employeeColumns = await tx.execute('PRAGMA table_info("KbizEmployeeAllocation")');
      if (!['id', 'transactionId', 'employeeId', 'employeeName', 'paymentType', 'paymentMonth', 'amountCents'].every(name => employeeColumns.rows.some(column => column.name === name))) throw new Error('Incompatible employee reconciliation table');
      await tx.commit(); return 'already-applied';
    }
    if (existing.rows.length) throw new Error('Incomplete employee reconciliation schema');
    const sql = await readFile(new URL('../prisma/migrations/20261024140000_add_employee_reconciliation/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      if (hasKind && (statement.startsWith('ALTER TABLE') || statement.startsWith('UPDATE'))) continue;
      await tx.execute(statement);
    }
    await tx.commit(); return 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Employee reconciliation migration: ${await applyEmployeeReconciliationMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate employee reconciliation:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
