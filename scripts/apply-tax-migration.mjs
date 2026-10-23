import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyTaxMigration(client) {
  const transaction = await client.transaction('write');
  try {
    const existing = await transaction.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('VatSale', 'VatPurchase', 'VatMonth')");
    if (existing.rows.length === 3) {
      const expected = { VatSale: ['referenceKey', 'taxDate', 'amountCents', 'vatCents'], VatPurchase: ['month', 'supplier', 'invoiceNumber', 'amountCents', 'vatCents', 'creditable', 'expense', 'vatMode'], VatMonth: ['month', 'openingCreditCents', 'creditAction'] };
      for (const [table, names] of Object.entries(expected)) {
        const columns = await transaction.execute(`PRAGMA table_info("${table}")`);
        if (!names.every(name => columns.rows.some(column => column.name === name))) throw new Error('Tax schema is incompatible.');
      }
      await transaction.commit();
      return 'already-applied';
    }
    if (existing.rows.length) throw new Error('Partial tax schema found. Review it before applying.');
    const sql = await readFile(new URL('../prisma/migrations/20261023010000_add_vat_ledger/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await transaction.execute(statement);
    await transaction.commit();
    return 'applied';
  } catch (error) { await transaction.rollback(); throw error; }
  finally { transaction.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const result = await applyTaxMigration(client);
    console.log(result === 'applied' ? 'VAT tables and indexes added. Existing data preserved.' : 'VAT tables are already available.');
  } catch { console.error('Unable to add VAT tables. Check database connectivity and schema.'); process.exitCode = 1; }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => { console.error('Turso configuration is missing or invalid.'); process.exitCode = 1; });
}
