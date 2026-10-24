import type { Prisma } from '@prisma/client';
import { isInvoiceScheduled, parseFinanceMonth } from './finance';
import { getInvoiceAmounts } from './invoice-template';

export async function documentDetails(db: Prisma.TransactionClient, sourceType: string, referenceKey: string) {
  let customer: string, description: string, amount: number, invoiceMonth: string;
  if (sourceType === 'RECURRING') {
    const match = /^recurring:(.+):(\d{4}-\d{2})$/.exec(referenceKey);
    const month = match && parseFinanceMonth(match[2]);
    if (!match || !month) return null;
    const source = await db.invoiceSchedule.findUnique({ where: { id: match[1] } });
    if (!source || !isInvoiceScheduled(source.period, source.issueMonth, month.month)) return null;
    customer = source.name; description = source.description; amount = source.amount; invoiceMonth = month.key;
  } else {
    if (!referenceKey.startsWith('project:')) return null;
    const source = await db.projectInvoice.findUnique({ where: { id: referenceKey.slice(8) }, include: { project: true } });
    if (!source) return null;
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(source.invoiceDate);
    invoiceMonth = `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
    customer = source.project.clientName; description = source.billingDescription; amount = source.amount;
  }
  const amounts = getInvoiceAmounts(amount);
  return { customer, description, invoiceMonth, netCents: Math.round(amounts.net * 100), grossCents: Math.round(amounts.total * 100) };
}
