import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyVendorWithholdingMigration(client) {
  const tx = await client.transaction('write');
  try {
    const vendor = await tx.execute('PRAGMA table_info("VendorPayment")');
    const tax = await tx.execute('PRAGMA table_info("RevenueTaxPayment")');
    if (!vendor.rows.length || !tax.rows.length) throw new Error('Install vendor and Revenue Department payment tables first');
    const columns = { VendorPayment: vendor.rows.map(row => row.name), RevenueTaxPayment: tax.rows.map(row => row.name) };
    const complete = columns.VendorPayment.includes('withholdingRate') && columns.VendorPayment.includes('withholdingBaseCents') && columns.RevenueTaxPayment.includes('vendorPaymentId');
    const sql = await readFile(new URL('../prisma/migrations/20261024180000_add_vendor_withholding/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      const alter = /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/.exec(statement);
      if (alter && columns[alter[1]].includes(alter[2])) continue;
      if (statement.startsWith('CREATE UNIQUE INDEX')) await tx.execute(statement.replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS'));
      else await tx.execute(statement);
    }
    await tx.commit(); return complete ? 'already-applied' : 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Vendor withholding migration: ${await applyVendorWithholdingMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate withholding:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
