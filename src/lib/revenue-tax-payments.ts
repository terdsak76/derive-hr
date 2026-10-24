import { parseFinanceMonth } from './finance';
import type { KbizRow } from './kbiz';

export type RevenueTaxPaymentRecord = {
  id: string; paymentNumber: string; paymentMonth: string; amountCents: number;
  status: string; allocatedCents: number;
  vendorPaymentId?: string | null;
  vendorPayment?: { vendorName: string; taxId: string; paymentNumber: string } | null;
  allocations?: { transactionId: string; amountCents: number; transaction: { transactionDate: string; accountNumber: string; details: string } }[];
};

export function parseRevenueTaxPayment(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  const month = parseFinanceMonth(value.paymentMonth);
  if (!month || !['string', 'number'].includes(typeof value.amount) || !/^\d+(\.\d{1,2})?$/.test(String(value.amount))) return null;
  const amountCents = Math.round(Number(value.amount) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) return null;
  return { paymentMonth: month.key, amountCents };
}

export function revenueTaxMatch(row: KbizRow, payment: RevenueTaxPaymentRecord) {
  if (!row.withdrawalCents || payment.status === 'COMPLETED') return { score: 0, reasons: [] as string[] };
  let score = 0;
  const reasons: string[] = [];
  if (row.withdrawalCents === payment.amountCents - payment.allocatedCents) { score += 20; reasons.push('ยอดเงินตรงกัน'); }
  if (/กรมสรรพากร|revenue\s*department/i.test(row.details)) { score += 10; reasons.push('ผู้รับเงินเป็นกรมสรรพากร'); }
  if (row.transactionDate.startsWith(payment.paymentMonth)) { score += 5; reasons.push('เดือนตรงกัน'); }
  return { score, reasons };
}
