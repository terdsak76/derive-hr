import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { importKbizCsv } from '../src/lib/kbiz-import';
import { prisma } from '../src/lib/prisma';

async function main() {
  const path = process.argv[2];
  if (!path || !path.toLowerCase().endsWith('.csv')) throw new Error('Usage: npm run kbiz:import -- <statement.csv>');
  if ((await stat(path)).size > 2_000_000) throw new Error('Select a CSV smaller than 2 MB');
  const result = await importKbizCsv(await readFile(path, 'utf8'), basename(path));
  console.log(`Imported ${result.imported} transactions; skipped ${result.skipped} duplicates.`);
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Import failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
