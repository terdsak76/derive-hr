import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyEmployeeTaxDetailsMigration(client) {
  const tx = await client.transaction('write');
  try {
    const columns = await tx.execute('PRAGMA table_info("Employee")');
    if (!columns.rows.length) throw new Error('Install Employee first');
    if (['taxId', 'address'].every(name => columns.rows.some(column => column.name === name))) { await tx.commit(); return 'already-applied'; }
    const sql = await readFile(new URL('../prisma/migrations/20261026150000_add_employee_tax_details/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      const field = /ADD COLUMN "([^"]+)"/.exec(statement)?.[1];
      if (!columns.rows.some(column => column.name === field)) await tx.execute(statement);
    }
    await tx.commit(); return 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Employee tax details migration: ${await applyEmployeeTaxDetailsMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate employee tax details:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
