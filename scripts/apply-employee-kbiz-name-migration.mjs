import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyEmployeeKbizNameMigration(client) {
  const tx = await client.transaction('write');
  try {
    const columns = await tx.execute('PRAGMA table_info("Employee")');
    if (!columns.rows.length) throw new Error('Employee table must be installed first');
    const allocation = await tx.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'KbizEmployeeAllocation'");
    if (!allocation.rows.length) throw new Error('Install employee reconciliation tables first');
    const hasName = columns.rows.some(column => column.name === 'kbizName');
    const hasTypes = ['PENDING', 'ONSITE', 'OTHERS'].every(type => String(allocation.rows[0].sql).includes(`'${type}'`));
    if (hasName && hasTypes) {
      await tx.commit(); return 'already-applied';
    }
    const sql = await readFile(new URL('../prisma/migrations/20261025090000_add_employee_kbiz_name/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      if (statement.startsWith('ALTER TABLE "Employee"')) {
        if (!hasName) await tx.execute(statement);
      } else if (!hasTypes) await tx.execute(statement);
    }
    await tx.commit(); return 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Employee Kbiz name migration: ${await applyEmployeeKbizNameMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate employee Kbiz name:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
