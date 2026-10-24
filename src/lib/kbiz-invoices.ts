import type { Prisma } from '@prisma/client';
import { isInvoiceScheduled, parseFinanceMonth } from './finance';
import { getInvoiceAmounts } from './invoice-template';
import type { KbizInvoice } from './kbiz';
import { documentDetails } from './document-details';

export async function kbizInvoices(db: Prisma.TransactionClient, monthKey: string): Promise<KbizInvoice[]> {
  const month = parseFinanceMonth(monthKey);
  if (!month) throw new Error('Invalid invoice month');
  const [schedules, projects, issued, allocations] = await Promise.all([
    db.invoiceSchedule.findMany(),
    db.projectInvoice.findMany({ where: { invoiceDate: { gte: month.start, lt: month.end } }, include: { project: true } }),
    db.issuedDocument.findMany({ orderBy: { documentType: 'asc' } }),
    db.kbizAllocation.groupBy({ by: ['referenceKey'], _sum: { amountCents: true } }),
  ]);
  // Prefer the invoice when both invoice and receipt exist for the same bill.
  const documents = new Map<string, typeof issued[number]>();
  for (const row of issued) if (!documents.has(row.referenceKey) || documents.get(row.referenceKey)!.status === 'INITIAL') documents.set(row.referenceKey, row);
  const paid = new Map(allocations.map(row => [row.referenceKey, row._sum.amountCents || 0]));
  const codes = new Map(schedules.map(row => [row.id, row.client]));
  const customerCode = (referenceKey: string) => codes.get(/^recurring:(.+):\d{4}-\d{2}$/.exec(referenceKey)?.[1] || '');
  function invoice(referenceKey: string, number: string, customer: string, description: string, amount: number): KbizInvoice {
    const amounts = getInvoiceAmounts(amount);
    const document = documents.get(referenceKey);
    return { referenceKey, invoiceNumber: document?.documentNumber || number, customer: document?.customer || customer,
      description: document?.description || description, month: document?.invoiceMonth || monthKey, status: document?.status || 'INITIAL', customerCode: customerCode(referenceKey),
      netCents: document?.netCents ?? Math.round(amounts.net * 100), grossCents: document?.grossCents ?? Math.round(amounts.total * 100), allocatedCents: paid.get(referenceKey) || 0 };
  }
  const result = new Map([
    ...schedules.filter(row => isInvoiceScheduled(row.period, row.issueMonth, month.month)).map(row =>
      invoice(`recurring:${row.id}:${monthKey}`, `${monthKey} / ${row.client}`, row.name, row.description, row.amount)),
    ...projects.map(row => invoice(`project:${row.id}`, row.invoiceNumber, row.project.clientName, row.billingDescription, row.amount)),
  ].map(item => [item.referenceKey, item]));
  // Printed documents remain available across billing months and after source edits.
  for (const document of documents.values()) {
    if (result.has(document.referenceKey) || document.status === 'INITIAL') continue;
    const details = document.netCents !== null && document.grossCents !== null ? document : await documentDetails(db, document.sourceType, document.referenceKey);
    if (!details) continue;
    result.set(document.referenceKey, { referenceKey: document.referenceKey, invoiceNumber: document.documentNumber,
      customer: details.customer, description: details.description, month: details.invoiceMonth, status: document.status,
      customerCode: customerCode(document.referenceKey),
      netCents: details.netCents, grossCents: details.grossCents, allocatedCents: paid.get(document.referenceKey) || 0 });
  }
  return Array.from(result.values());
}
