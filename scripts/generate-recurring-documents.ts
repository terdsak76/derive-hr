import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { generateRecurringDocuments } from '../src/lib/recurring-documents';

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter(arg => arg !== '--apply');
  const through = positional[1] || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const from = positional[0] || `${through.slice(0, 4)}-01`;
  const apply = args.includes('--apply');
  const result = await prisma.$transaction(tx => generateRecurringDocuments(tx, from, through, apply), { timeout: 60000 });
  const byMonth = Object.fromEntries(Array.from(new Set(result.documents.map(row => row.invoiceMonth))).map(month => [month, result.documents.filter(row => row.invoiceMonth === month).length]));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', from, through, created: result.created, pending: result.pending, existingSkipped: result.skipped, byMonth }, null, 2));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Generation failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
