export type KbizRow = {
  accountNumber: string; transactionDate: string; transactionTime: string;
  bankDescription: string; channel: string; details: string;
  withdrawalCents: number; depositCents: number; balanceCents: number;
};
export type KbizInvoice = {
  referenceKey: string; invoiceNumber: string; customer: string; description: string;
  month: string; netCents: number; grossCents: number; allocatedCents: number;
  status: string;
  customerCode?: string;
};
export type KbizAllocation = {
  referenceKey: string; invoiceNumber: string; customer: string; amountCents: number; expectedCents: number; basis: string;
};
export type KbizRecord = KbizRow & {
  id: string; sourceFile: string; expenseDescription: string; allocations: KbizAllocation[];
  expenseKind: string;
  vendorAllocations: { vendorPaymentId: string; amountCents: number; vendorPayment: { paymentNumber: string; vendorName: string } }[];
  employeeAllocations: { employeeId: string; employeeName: string; paymentType: string; paymentMonth: string; amountCents: number }[];
  taxAllocations: { taxPaymentId: string; amountCents: number; taxPayment: { paymentNumber: string; paymentMonth: string } }[];
};

export type KbizEmployee = { id: string; name: string; department: string };

export const employeePaymentTypes = [
  { value: 'PAYROLL', label: 'Salary / เงินเดือน' },
  { value: 'INCENTIVE', label: 'Incentive' },
  { value: 'ONSITE', label: 'Onsite' },
  { value: 'OTHERS', label: 'Others / อื่น ๆ' },
] as const;

export const employeePaymentTypeLabel = (type: string) =>
  employeePaymentTypes.find(item => item.value === type)?.label || 'Pending / รอเลือกประเภท';

export function kbizReconciliationStatus(row: Pick<KbizRecord, 'depositCents' | 'withdrawalCents' | 'allocations' | 'vendorAllocations' | 'employeeAllocations' | 'taxAllocations' | 'expenseDescription' | 'expenseKind'>) {
  if (row.employeeAllocations.some(item => item.paymentType === 'PENDING')) return 'PENDING';
  const total = row.depositCents ? row.allocations.reduce((sum, item) => sum + item.amountCents, 0) :
    row.vendorAllocations.reduce((sum, item) => sum + item.amountCents, 0) + row.employeeAllocations.reduce((sum, item) => sum + item.amountCents, 0) + row.taxAllocations.reduce((sum, item) => sum + item.amountCents, 0);
  if (total) return total === (row.depositCents || row.withdrawalCents) ? 'COMPLETED' : 'PARTIAL';
  if (row.withdrawalCents && row.expenseKind === 'OTHER' && row.expenseDescription.trim()) return 'COMPLETED';
  return 'INITIAL';
}

/** RFC 4180 fields, including the quoted multiline account name in K BIZ exports. */
function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field !== '') throw new Error('Invalid CSV quoting');
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(field.trim()); field = '';
      if (char !== ',') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        rows.push(row); row = [];
      }
    } else field += char;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

function cents(text: string, required = false) {
  if (!text && !required) return 0;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid bank amount');
  const result = Math.round(Number(text.replaceAll(',', '')) * 100);
  if (!Number.isSafeInteger(result) || result > 2_147_483_647) throw new Error('Bank amount is too large');
  return result;
}

export function parseKbizCsv(text: string): KbizRow[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const header = rows.findIndex(row => row[1] === 'วันที่' && row[4] === 'ถอนเงิน' && row[6] === 'ฝากเงิน' && row[8] === 'ยอดคงเหลือ');
  const accountNumber = rows.flat().find(cell => /^\d{3}-\d-\d{5}-\d$/.test(cell));
  if (header < 0 || !accountNumber) throw new Error('Please select a K BIZ detailed savings statement CSV');
  const result: KbizRow[] = [];
  let previousBalance: number | undefined;
  for (const row of rows.slice(header + 1)) {
    if (row.every(cell => !cell)) continue;
    const match = /^(\d{2})-(\d{2})-(\d{2}|\d{4})$/.exec(row[1] || '');
    if (!match) throw new Error('Invalid transaction date in statement');
    const [, day, month, rawYear] = match;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    const date = `${year}-${month}-${day}`;
    if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Invalid transaction date');
    const withdrawalCents = cents(row[4] || ''), depositCents = cents(row[6] || ''), balanceCents = cents(row[8] || '', true);
    if (row[3] === 'ยอดยกมา' && !withdrawalCents && !depositCents) { previousBalance = balanceCents; continue; }
    if ((withdrawalCents > 0) === (depositCents > 0)) throw new Error('A transaction must have either a deposit or a withdrawal');
    if (previousBalance !== undefined && previousBalance + depositCents - withdrawalCents !== balanceCents) throw new Error('Statement running balance does not match');
    previousBalance = balanceCents;
    result.push({ accountNumber, transactionDate: date, transactionTime: row[2] || '', bankDescription: row[3] || '',
      withdrawalCents, depositCents, balanceCents, channel: row[10] || '', details: row[12] || '' });
  }
  if (!result.length) throw new Error('No transactions found');
  const closing = rows.slice(0, header).find(row => row[7] === 'ยอดยกไป');
  if (closing && cents(closing[12], true) !== result[result.length - 1].balanceCents) throw new Error('Statement closing balance does not match');
  for (const [label, column] of [['รวมถอนเงิน', 'withdrawalCents'], ['รวมฝากเงิน', 'depositCents']] as const) {
    const summary = rows.slice(0, header).find(row => row[7] === label);
    const transactions = result.filter(row => row[column] > 0);
    if (summary && (Number(summary[9]) !== transactions.length || cents(summary[12], true) !== transactions.reduce((sum, row) => sum + row[column], 0))) {
      throw new Error('Statement totals do not match transaction rows');
    }
  }
  return result;
}
