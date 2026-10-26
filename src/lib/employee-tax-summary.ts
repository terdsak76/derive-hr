export type TaxSummaryRow = {
  id: string; name: string; taxId: string; address: string;
  salaryCents: number; incentiveCents: number; bonusCents: number; overtimeCents: number;
  socialSecurityCents: number; totalCents: number; withheldCents: number; warnings: string[];
};
export type EmployeeTaxReport = { year: number; throughMonth: string; employees: TaxSummaryRow[] };
export type SalaryPeriod = { salaryCents: number | null; startDate: Date; endDate: Date | null; isOpening: boolean };

export function parseTaxYear(value: unknown): number | null {
  return typeof value === 'string' && /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 9998 ? Number(value) : null;
}

// Salary history stores date-only values at UTC midnight. Prorate changes within
// a month by calendar days; this is an accrual, not evidence of a bank payment.
export function annualSalary(periods: SalaryPeriod[], year: number, through: number, isOwner: boolean) {
  let salaryCents = 0; let socialSecurityCents = 0; let missingDays = 0;
  for (let month = 0; month < through; month++) {
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let monthly = 0;
    for (let day = 1; day <= days; day++) {
      const date = Date.UTC(year, month, day);
      const period = periods.find(item => item.startDate.getTime() <= date && (!item.endDate || item.endDate.getTime() >= date));
      if (period?.salaryCents != null) monthly += period.salaryCents / days;
      else missingDays++;
    }
    const rounded = Math.round(monthly);
    salaryCents += rounded;
    // Existing app contribution rule. The report labels this an estimate and
    // asks the administrator to verify actual employee deductions before print.
    socialSecurityCents += isOwner ? 0 : Math.min(87500, Math.round(rounded * 0.05));
  }
  return { salaryCents, socialSecurityCents, missingDays };
}

export type CertificateAmounts = Pick<TaxSummaryRow, 'salaryCents' | 'incentiveCents' | 'bonusCents' | 'overtimeCents' | 'socialSecurityCents'>;
export const certificateAmountKeys = ['salaryCents', 'incentiveCents', 'bonusCents', 'overtimeCents', 'socialSecurityCents'] as const;
export function validCertificateAmounts(value: unknown): value is CertificateAmounts {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return certificateAmountKeys.every(key => typeof data[key] === 'number' && Number.isSafeInteger(data[key]) && Number(data[key]) >= 0 && Number(data[key]) <= 100_000_000_000)
    && Number(data.socialSecurityCents) <= Number(data.salaryCents) + Number(data.incentiveCents) + Number(data.bonusCents) + Number(data.overtimeCents);
}
