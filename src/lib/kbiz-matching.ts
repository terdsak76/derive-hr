import type { KbizInvoice, KbizRow } from './kbiz';

const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const generic = new Set(['company', 'limited', 'co', 'ltd', 'comp', 'corporation', 'บริษัท', 'จำกัด', 'บจก', 'มหาชน', 'the', 'service', 'services', 'payment', 'invoice']);

/** Suggestions are evidence for admin review, never automatic payment postings. */
export function kbizMatch(row: KbizRow, invoice: KbizInvoice) {
  if (invoice.status === 'INITIAL' || !row.depositCents) return { score: 0, reasons: [] as string[] };
  const text = normalize(`${row.bankDescription} ${row.details}`);
  const reasons: string[] = [];
  let score = 0;
  const number = normalize(invoice.invoiceNumber);
  if (number.length >= 6 && text.includes(number)) { score += 100; reasons.push('เลขเอกสารตรงกัน'); }
  const customer = normalize(invoice.customer.replace(/บริษัท|จำกัด|บจก\.?|มหาชน|company|limited|\bltd\b|\bco\b/gi, ''));
  const tokens = invoice.customer.split(/[\s.,()]+/).map(normalize).filter(token => token.length >= 3 && !generic.has(token));
  if ((customer.length >= 4 && text.includes(customer)) || tokens.some(token => text.includes(token))) { score += 40; reasons.push('ชื่อลูกค้าตรงกับรายละเอียดธนาคาร'); }
  const code = normalize(invoice.customerCode || '');
  const bankWords = (row.details.match(/[a-z]{3,12}/gi) || []).map(normalize);
  if (code.length >= 3 && bankWords.includes(code)) { score += 35; reasons.push('รหัสลูกค้าตรงกัน'); }
  else if (/^[a-z]{4,6}$/.test(code) && bankWords.some(word => word.length === code.length - 1 &&
    Array.from(code).some((_, index) => code.slice(0, index) + code.slice(index + 1) === word))) {
    score += 25; reasons.push('ชื่อย่อใกล้เคียงรหัสลูกค้า (ตรวจสอบ)');
  }
  const description = normalize(invoice.description);
  if (description.length >= 8 && text.includes(description)) { score += 30; reasons.push('คำอธิบายตรงกัน'); }
  const remainingNet = invoice.netCents - invoice.allocatedCents;
  const remainingGross = invoice.grossCents - invoice.allocatedCents;
  if (remainingNet > 0 && remainingNet === row.depositCents) { score += 20; reasons.push('ยอดสุทธิหลังหัก 3% ตรงกัน'); }
  else if (remainingGross > 0 && remainingGross === row.depositCents) { score += 20; reasons.push('ยอดรวม VAT ตรงกัน'); }
  return { score, reasons };
}
