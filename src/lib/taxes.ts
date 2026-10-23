import { amountToCents } from './finance';

export function socialSecurityCents(salaryCents: number | null, isOwner = false): number {
  if (isOwner) return 0;
  return Math.min(87500, Math.round(Math.max(0, salaryCents || 0) * 5 / 100));
}

export function vatAmounts(value: number, inclusive = false) {
  const cents = amountToCents(value);
  const vatCents = inclusive ? Math.round(cents * 7 / 107) : Math.round(cents * 7 / 100);
  return { amountCents: inclusive ? cents - vatCents : cents, vatCents };
}

export function parseTaxDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isFinite(date.getTime()) && new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(date) === value ? date : null;
}

export const taxDateText = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(date);

export function validTaxAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && amountToCents(value) <= 2000000000
    && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

export function vatSettlement(output: number, input: number, broughtForward: number, openingAdjustment: number, action: string) {
  const balance = output - input - broughtForward - openingAdjustment;
  const credit = Math.max(0, -balance);
  return { payable: Math.max(0, balance), carryForward: action === 'REFUND' ? 0 : credit, refundRequested: action === 'REFUND' ? credit : 0 };
}

export type TaxMonthSummary = {
  month: string; sales: number; outputVat: number; inputVat: number; broughtForward: number;
  openingCredit: number; creditAction: string; payable: number; carryForward: number; refundRequested: number;
  employerSocialSecurity: number; employeeSocialSecurity: number; totalSocialSecurity: number;
};
export type TaxReport = {
  month: string; monthly: TaxMonthSummary[]; summary: TaxMonthSummary;
  employees: { id: string; name: string; isOwner: boolean; salary: number | null; employer: number; employee: number; total: number }[];
  purchases: { id: string; month: string; purchaseDate: string; supplier: string; invoiceNumber: string; description: string; amount: number; vat: number; creditable: boolean; expense: boolean; vatMode: string }[];
  sales: { id: string; referenceKey: string; invoiceNumber: string; customer: string; description: string; taxDate: string; amount: number; vat: number }[];
  invoices: { referenceKey: string; sourceType: string; sourceId: string; invoiceMonth: string; invoiceNumber: string; customer: string; description: string; amount: number; recorded: boolean }[];
};
