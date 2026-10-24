import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyDocumentStatusMigration(client) {
  const tx = await client.transaction('write');
  try {
    const columns = await tx.execute('PRAGMA table_info("IssuedDocument")');
    const names = ['status', 'customer', 'description', 'invoiceMonth', 'netCents', 'grossCents'];
    const found = names.filter(name => columns.rows.some(column => column.name === name));
    if (found.length === names.length) { await tx.commit(); return 'already-applied'; }
    if (!columns.rows.length) throw new Error('IssuedDocument table is missing');
    for (const name of found) {
      const column = columns.rows.find(column => column.name === name);
      if (column.type !== (name.endsWith('Cents') ? 'INTEGER' : 'TEXT')) throw new Error(`Incompatible existing column: ${name}`);
    }
    if (found.includes('status')) {
      const invalid = await tx.execute("SELECT COUNT(*) AS count FROM IssuedDocument WHERE status NOT IN ('INITIAL', 'ISSUED', 'COMPLETED') OR status IS NULL");
      if (Number(invalid.rows[0].count)) throw new Error('Existing document statuses require review');
    }
    const sql = await readFile(new URL('../prisma/migrations/20261024100000_add_document_status/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      const column = /ADD COLUMN "([^"]+)"/.exec(statement)?.[1];
      if (column && found.includes(column)) continue;
      if (statement.startsWith('UPDATE') && found.includes('status')) continue;
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
  try { console.log(`Document status migration: ${await applyDocumentStatusMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate document statuses:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
