import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyOwnerMigration(client, ownerIds = []) {
  const ids = [...new Set(ownerIds)];
  const transaction = await client.transaction('write');
  try {
    const placeholders = ids.map(() => '?').join(', ');
    if (ids.length) {
      const targets = await transaction.execute({ sql: `SELECT id FROM Employee WHERE id IN (${placeholders})`, args: ids });
      if (targets.rows.length !== ids.length) throw new Error('An owner account was not found.');
    }
    const columns = await transaction.execute('PRAGMA table_info("Employee")');
    const applied = !columns.rows.some(column => column.name === 'isOwner');
    if (applied) {
      const sql = await readFile(new URL('../prisma/migrations/20261023020000_add_employee_owner/migration.sql', import.meta.url), 'utf8');
      await transaction.execute(sql);
    }
    if (ids.length) await transaction.execute({ sql: `UPDATE Employee SET isOwner = 1 WHERE id IN (${placeholders})`, args: ids });
    const owners = ids.length ? (await transaction.execute({ sql: `SELECT id, name, isOwner FROM Employee WHERE id IN (${placeholders})`, args: ids })).rows : [];
    await transaction.commit();
    return { applied, owners };
  } catch (error) { await transaction.rollback(); throw error; }
  finally { transaction.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  const ids = [];
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== '--employee-id' || !args[index + 1]) throw new Error('Use --employee-id followed by an exact employee ID.');
    ids.push(args[index + 1]);
  }
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing database configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const result = await applyOwnerMigration(client, ids);
    console.log(result.applied ? 'Owner flag column added. Existing data preserved.' : 'Owner flag column is already available.');
    if (result.owners.length) console.log('Owner status saved:', JSON.stringify(result.owners));
  } catch { console.error('Unable to apply owner flags. Check database connectivity, schema, and exact employee IDs.'); process.exitCode = 1; }
  finally { client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => { console.error('Invalid owner migration arguments or database configuration.'); process.exitCode = 1; });
}
