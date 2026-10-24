import type { KbizRow } from './kbiz';

export type VendorPaymentRecord = {
  id: string; paymentNumber: string; vendorName: string; taxId: string;
  amountCents: number; paymentDate: string; description: string;
  status: string; printedAt: string | null; allocatedCents: number;
  withholdingRate?: number; withholdingBaseCents?: number;
  withholdingCents?: number; netCents?: number;
  allocations?: { transactionId: string; amountCents: number; transaction: { transactionDate: string; accountNumber: string; details: string } }[];
};

export function parseVendorPayment(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  if (typeof value.vendorName !== 'string' || !value.vendorName.trim() || value.vendorName.trim().length > 200 ||
    typeof value.taxId !== 'string' || !value.taxId.trim() || value.taxId.trim().length > 30 ||
    typeof value.description !== 'string' || value.description.length > 500 ||
    !['string', 'number'].includes(typeof value.amount) || !/^\d+(\.\d{1,2})?$/.test(String(value.amount)) ||
    typeof value.paymentDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.paymentDate)) return null;
  const date = new Date(`${value.paymentDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.paymentDate || Number(value.paymentDate.slice(0, 4)) < 2000) return null;
  const amountCents = Math.round(Number(value.amount) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) return null;
  if (value.withholdingEnabled !== undefined && typeof value.withholdingEnabled !== 'boolean') return null;
  const withholdingRate = value.withholdingEnabled ? 3 : 0;
  let withholdingBaseCents = 0;
  if (withholdingRate) {
    if (!['string', 'number'].includes(typeof value.withholdingBase) || !/^\d+(\.\d{1,2})?$/.test(String(value.withholdingBase))) return null;
    withholdingBaseCents = Math.round(Number(value.withholdingBase) * 100);
    if (!Number.isSafeInteger(withholdingBaseCents) || withholdingBaseCents <= 0 || withholdingBaseCents > amountCents) return null;
  }
  const amounts = vendorPaymentAmounts({ amountCents, withholdingRate, withholdingBaseCents });
  if (amounts.netCents <= 0 || (withholdingRate && amounts.withholdingCents === 0)) return null;
  return { vendorName: value.vendorName.trim(), taxId: value.taxId.trim(), description: value.description.trim(), paymentDate: value.paymentDate, amountCents, withholdingRate, withholdingBaseCents };
}

export function vendorPaymentAmounts(payment: { amountCents: number; withholdingRate?: number; withholdingBaseCents?: number }) {
  const withholdingCents = Math.round((payment.withholdingBaseCents || 0) * (payment.withholdingRate || 0) / 100);
  return { withholdingCents, netCents: payment.amountCents - withholdingCents };
}

const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function vendorPaymentMatch(row: KbizRow, payment: VendorPaymentRecord) {
  const reasons: string[] = [];
  let score = 0;
  if (!row.withdrawalCents || payment.status !== 'PRINTED') return { score, reasons };
  const text = normalize(`${row.bankDescription} ${row.details}`);
  if (text.includes(normalize(payment.paymentNumber))) { score += 100; reasons.push('เลขใบจ่ายตรงกัน'); }
  const name = normalize(payment.vendorName.replace(/บริษัท|จำกัด|บจก\.?|มหาชน|company|limited|\bltd\b/gi, ''));
  if (name.length >= 4 && text.includes(name)) { score += 40; reasons.push('ชื่อ Vendor ตรงกัน'); }
  const tax = normalize(payment.taxId);
  if (tax.length >= 6 && text.includes(tax)) { score += 40; reasons.push('Tax ID ตรงกัน'); }
  if (vendorPaymentAmounts(payment).netCents - payment.allocatedCents === row.withdrawalCents) { score += 20; reasons.push('ยอดสุทธิเงินโอนตรงกัน'); }
  return { score, reasons };
}

export function renderVendorPaymentHtml(payment: Pick<VendorPaymentRecord, 'paymentNumber' | 'vendorName' | 'taxId' | 'paymentDate' | 'description' | 'amountCents' | 'withholdingRate' | 'withholdingBaseCents'>) {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const amount = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(payment.amountCents / 100);
  const totals = vendorPaymentAmounts(payment);
  const money = (cents: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(payment.paymentNumber)}</title><style>
    @page { size: A4; margin: 20mm; } body { font: 15px Tahoma, Arial, sans-serif; line-height: 1.8; color: #172033; }
    h1 { margin-bottom: 4px; } .meta { color: #475569; } table { width: 100%; border-collapse: collapse; margin: 28px 0; }
    td, th { border: 1px solid #cbd5e1; padding: 14px; text-align: left; } .amount { text-align: right; white-space: nowrap; }
    .description { white-space: pre-wrap; } footer { margin-top: 80px; display: flex; justify-content: space-between; }
    </style></head><body><h1>ใบสำคัญจ่าย / Payment Voucher</h1><p class="meta">${escape(payment.paymentNumber)} · วันที่ ${escape(payment.paymentDate)}</p>
    <p><strong>ผู้รับเงิน / Vendor:</strong> ${escape(payment.vendorName)}<br><strong>เลขประจำตัวผู้เสียภาษี / Tax ID:</strong> ${escape(payment.taxId)}</p>
    <table><thead><tr><th>รายการ / Description</th><th class="amount">ยอดก่อนหัก ณ ที่จ่าย / THB</th></tr></thead><tbody><tr><td class="description">${escape(payment.description || 'Vendor payment')}</td><td class="amount">${amount}</td></tr>
    ${payment.withholdingRate ? `<tr><td>ฐานภาษีหัก ณ ที่จ่าย (ไม่รวม VAT)</td><td class="amount">${money(payment.withholdingBaseCents || 0)}</td></tr><tr><td>หัก ณ ที่จ่าย 3%</td><td class="amount">${money(totals.withholdingCents)}</td></tr>` : ''}
    <tr><th>ยอดสุทธิโอนให้ Vendor</th><th class="amount">${money(totals.netCents)}</th></tr></tbody></table>
    <footer><span>ผู้จัดทำ __________________</span><span>ผู้อนุมัติ __________________</span><span>ผู้รับเงิน __________________</span></footer></body></html>`;
}
