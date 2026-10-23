export type SalaryHistoryRow = {
  id: string; salary: number | null; fullIncentive: number;
  startDate: string; endDate: string | null; isOpening: boolean;
};
export type SalaryHistoryEmployee = {
  id: string; name: string; department: string; salary: number | null;
  fullIncentive: number; history: SalaryHistoryRow[];
};

// Effective dates are date-only values, stored at UTC midnight to avoid DST and
// server timezone dependencies. They are not work timestamps.
export function parseSalaryDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    value >= '2000-01-01' && value <= '9998-12-31' ? date : null;
}

export function previousSalaryDay(date: Date): Date {
  return new Date(date.getTime() - 86400000);
}

export function parseCompensationCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 21474836.47 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) return null;
  return Math.round(value * 100);
}
