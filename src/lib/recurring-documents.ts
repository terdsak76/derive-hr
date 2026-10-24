import type { Prisma } from '@prisma/client';
import { isInvoiceScheduled, parseFinanceMonth } from './finance';
import { getInvoiceAmounts } from './invoice-template';

/** Prepare due invoice drafts; printing and reconciliation own later transitions. */
export async function generateRecurringDocuments(db: Prisma.TransactionClient, fromMonth: string, throughDate: string, apply = false) {
  const first = parseFinanceMonth(fromMonth);
  const last = parseFinanceMonth(throughDate.slice(0, 7));
  const parsedDate = new Date(`${throughDate}T00:00:00Z`);
  if (!first || !last || !/^\d{4}-\d{2}-\d{2}$/.test(throughDate) || Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== throughDate || fromMonth > throughDate.slice(0, 7) || last.year - first.year > 10) {
    throw new Error('Supply a valid start month and end date, at most ten years apart');
  }
  const [schedules, documents, projects] = await Promise.all([
    db.invoiceSchedule.findMany({ orderBy: [{ client: 'asc' }, { id: 'asc' }] }),
    db.issuedDocument.findMany({ select: { referenceKey: true, documentType: true, sourceType: true, documentNumber: true } }),
    db.projectInvoice.findMany({ select: { invoiceNumber: true } }),
  ]);
  const existing = new Set(documents.filter(row => row.documentType === 'INVOICE' && row.sourceType === 'RECURRING').map(row => row.referenceKey));
  const usedNumbers = new Set([...documents.map(row => row.documentNumber), ...projects.map(row => row.invoiceNumber)]);
  const sequences = new Map<number, number>();
  for (const number of usedNumbers) {
    const match = /^INV-(\d{4})[-/](\d+)$/i.exec(number);
    if (match) sequences.set(Number(match[1]), Math.max(sequences.get(Number(match[1])) || 0, Number(match[2])));
  }
  const pending: { referenceKey: string; documentNumber: string; invoiceMonth: string; customer: string; description: string;
    scheduledDate: string; netCents: number; grossCents: number }[] = [];
  let skipped = 0;
  for (let index = first.year * 12 + first.month - 1; index <= last.year * 12 + last.month - 1; index++) {
    const year = Math.floor(index / 12), month = index % 12 + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const occurrences = schedules.filter(row => isInvoiceScheduled(row.period, row.issueMonth, month)).sort((a, b) => a.issueDay - b.issueDay || a.id.localeCompare(b.id));
    for (const schedule of occurrences) {
      if (!Number.isInteger(schedule.issueDay) || schedule.issueDay < 1 || schedule.issueDay > 31) throw new Error(`Invalid issue day for ${schedule.id}`);
      // A day such as the 31st falls on the last day in shorter months.
      const day = Math.min(schedule.issueDay, new Date(Date.UTC(year, month, 0)).getUTCDate());
      const scheduledDate = `${key}-${String(day).padStart(2, '0')}`;
      if (scheduledDate > throughDate) continue;
      const referenceKey = `recurring:${schedule.id}:${key}`;
      if (existing.has(referenceKey)) { skipped++; continue; }
      let sequence = sequences.get(year) || 0, documentNumber: string;
      do { sequence++; documentNumber = `INV-${year}-${String(sequence).padStart(3, '0')}`; } while (usedNumbers.has(documentNumber));
      sequences.set(year, sequence); usedNumbers.add(documentNumber); existing.add(referenceKey);
      const amounts = getInvoiceAmounts(schedule.amount);
      pending.push({ referenceKey, documentNumber, invoiceMonth: key, customer: schedule.name, description: schedule.description,
        scheduledDate, netCents: Math.round(amounts.net * 100), grossCents: Math.round(amounts.total * 100) });
    }
  }
  if (apply) for (const { scheduledDate, ...data } of pending) {
    await db.issuedDocument.create({ data: { ...data, documentType: 'INVOICE', sourceType: 'RECURRING', status: 'INITIAL', issuedAt: new Date(`${scheduledDate}T00:00:00+07:00`) } });
  }
  return { created: apply ? pending.length : 0, pending: pending.length, skipped, documents: pending };
}
