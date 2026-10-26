import type { Prisma } from '@prisma/client';
import type { KbizInvoice, KbizRow } from './kbiz';
import { kbizInvoices } from './kbiz-invoices';
import { syncDocumentStatuses } from './document-status';

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const generic = new Set(['company', 'limited', 'co', 'ltd', 'corporation', 'บริษัท', 'จำกัด', 'บจก', 'มหาชน', 'service', 'services', 'payment', 'invoice']);

export function followingInvoiceMonth(month: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, number] = month.split('-').map(Number);
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
}

/** Require customer evidence as well as the following billing month. Amount alone is insufficient. */
export function depositCustomerEvidence(row: KbizRow, invoice: KbizInvoice): string | null {
  if (row.depositCents <= 0 || row.withdrawalCents > 0 || invoice.status === 'INITIAL' ||
      followingInvoiceMonth(invoice.month) !== row.transactionDate.slice(0, 7)) return null;
  const descriptions = [row.bankDescription, row.details];
  const customer = normalize(invoice.customer.replace(/บริษัท|จำกัด|บจก\.?|มหาชน|\b(?:company|limited|co|ltd|comp|corporation)\b/gi, ''));
  if (customer.length >= 4 && !generic.has(customer) && descriptions.some(text => normalize(text).includes(customer))) return 'ชื่อลูกค้าตรงกัน';
  const code = normalize(invoice.customerCode || '');
  if (code.length >= 3 && !generic.has(code) && descriptions.some(text =>
    (text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || []).some(word => word === code))) return 'รหัส Client ตรงกัน';
  return null;
}

type PaidAllocation = { referenceKey: string; basis: string };
export function selectDepositMatch(row: KbizRow, invoices: KbizInvoice[], paid: PaidAllocation[]) {
  const candidates = invoices.flatMap(invoice => {
    const evidence = depositCustomerEvidence(row, invoice);
    if (!evidence) return [];
    const bases = new Set(paid.filter(item => item.referenceKey === invoice.referenceKey).map(item => item.basis));
    if (bases.size > 1) return [];
    const basis = bases.values().next().value || (invoice.grossCents - invoice.allocatedCents === row.depositCents ? 'GROSS' : 'NET');
    const expectedCents = basis === 'NET' ? invoice.netCents : invoice.grossCents;
    const remaining = expectedCents - invoice.allocatedCents;
    if (remaining <= 0) return [];
    return [{ invoice, basis, expectedCents, amountCents: Math.min(remaining, row.depositCents), exact: remaining === row.depositCents,
      reason: `${evidence} · เงินฝากเดือนถัดจาก Invoice${remaining === row.depositCents ? ' · ยอดเงินตรงกัน' : ' · ตรวจสอบยอดรับชำระบางส่วน'}` }];
  });
  const exact = candidates.filter(item => item.exact);
  // Several bills with the same customer and month need a manual decision.
  return exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : null;
}

export class DepositMatchError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export async function suggestDepositMatches(tx: Prisma.TransactionClient, transactionIds: string[], createdById: string) {
  if (!transactionIds.length) return { matched: 0, unmatched: 0 };
  const rows = await tx.kbizTransaction.findMany({
    where: { id: { in: transactionIds }, depositCents: { gt: 0 }, withdrawalCents: 0,
      allocations: { none: {} }, depositSuggestions: { none: { status: 'PENDING' } } },
    include: { depositSuggestions: { select: { referenceKey: true } } },
    orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
  });
  if (!rows.length) return { matched: 0, unmatched: 0 };
  // kbizInvoices includes printed snapshots from every month, even if their source was edited.
  const invoices = await kbizInvoices(tx, rows[0].transactionDate.slice(0, 7));
  const paid = await tx.kbizAllocation.findMany({ select: { referenceKey: true, basis: true } });
  const pending = await tx.kbizDepositSuggestion.findMany({ where: { status: 'PENDING' }, select: { referenceKey: true } });
  const reserved = new Set(pending.map(item => item.referenceKey));
  let matched = 0;
  for (const row of rows) {
    const previous = new Set(row.depositSuggestions.map(item => item.referenceKey));
    const match = selectDepositMatch(row, invoices.filter(invoice => !reserved.has(invoice.referenceKey) && !previous.has(invoice.referenceKey)), paid);
    if (!match) continue;
    await tx.kbizDepositSuggestion.create({ data: {
      transactionId: row.id, referenceKey: match.invoice.referenceKey, invoiceNumber: match.invoice.invoiceNumber,
      invoiceMonth: match.invoice.month, customer: match.invoice.customer, amountCents: match.amountCents,
      expectedCents: match.expectedCents, basis: match.basis, reason: match.reason, createdById,
    } });
    reserved.add(match.invoice.referenceKey);
    matched++;
  }
  return { matched, unmatched: rows.length - matched };
}

export async function reviewDepositMatch(tx: Prisma.TransactionClient, id: string, status: 'CONFIRMED' | 'REJECTED', reviewedById: string) {
  const suggestion = await tx.kbizDepositSuggestion.findUnique({ where: { id }, include: { transaction: { include: { allocations: true } } } });
  if (!suggestion || suggestion.status !== 'PENDING') throw new DepositMatchError('รายการนี้ถูกตรวจสอบแล้วหรือไม่พบรายการ กรุณารีเฟรช');
  const claimed = await tx.kbizDepositSuggestion.updateMany({ where: { id, status: 'PENDING' }, data: { status, reviewedById, reviewedAt: new Date() } });
  if (!claimed.count) throw new DepositMatchError('รายการนี้ถูกตรวจสอบแล้ว กรุณารีเฟรช');
  if (status === 'REJECTED') return;

  const row = suggestion.transaction;
  if (row.depositCents <= 0 || row.withdrawalCents > 0 || row.allocations.length) throw new DepositMatchError('รายการธนาคารมีการเปลี่ยนแปลง กรุณาจับคู่ด้วยตนเอง');
  const invoice = (await kbizInvoices(tx, suggestion.invoiceMonth)).find(item => item.referenceKey === suggestion.referenceKey);
  if (!invoice || !depositCustomerEvidence(row, invoice) || invoice.invoiceNumber !== suggestion.invoiceNumber ||
      invoice.customer !== suggestion.customer || invoice.month !== suggestion.invoiceMonth ||
      (suggestion.basis === 'NET' ? invoice.netCents : invoice.grossCents) !== suggestion.expectedCents) {
    throw new DepositMatchError('ข้อมูล Invoice เปลี่ยนแปลง กรุณาตรวจสอบและจับคู่ด้วยตนเอง');
  }
  const paid = await tx.kbizAllocation.findMany({ where: { referenceKey: suggestion.referenceKey } });
  if (paid.some(item => item.basis !== suggestion.basis) || suggestion.amountCents > row.depositCents ||
      paid.reduce((sum, item) => sum + item.amountCents, 0) + suggestion.amountCents > suggestion.expectedCents) {
    throw new DepositMatchError('ยอดคงเหลือหรือวิธีรับเงินเปลี่ยนแปลง กรุณาตรวจสอบและจับคู่ด้วยตนเอง');
  }
  await tx.kbizAllocation.create({ data: {
    transactionId: row.id, referenceKey: invoice.referenceKey, invoiceNumber: invoice.invoiceNumber,
    customer: invoice.customer, amountCents: suggestion.amountCents, expectedCents: suggestion.expectedCents, basis: suggestion.basis,
  } });
  await tx.kbizTransaction.update({ where: { id: row.id }, data: { updatedById: reviewedById } });
  await syncDocumentStatuses(tx, [invoice.referenceKey]);
}
