import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

export async function applyVendorPaymentMigration(client) {
  const tx = await client.transaction('write');
  try {
    const existing = await tx.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('VendorPayment', 'KbizVendorAllocation')");
    if (existing.rows.length === 2) {
      const expected = {
        VendorPayment: ['id', 'paymentNumber', 'vendorName', 'taxId', 'amountCents', 'paymentDate', 'description', 'status', 'printedAt', 'updatedById', 'createdAt', 'updatedAt'],
        KbizVendorAllocation: ['id', 'transactionId', 'vendorPaymentId', 'amountCents'],
      };
      for (const [table, names] of Object.entries(expected)) {
        const columns = await tx.execute(`PRAGMA table_info("${table}")`);
        if (!names.every(name => columns.rows.some(column => column.name === name))) throw new Error('Incompatible vendor payment schema');
      }
      await tx.commit(); return 'already-applied';
    }
    if (existing.rows.length) throw new Error('Partial vendor payment schema; review before applying');
    const sql = await readFile(new URL('../prisma/migrations/20261024120000_add_vendor_payments/migration.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await tx.execute(statement);
    await tx.commit(); return 'applied';
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  await import('dotenv/config');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing configuration');
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try { console.log(`Vendor payment migration: ${await applyVendorPaymentMigration(client)}`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Unable to migrate vendor payments:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
}
