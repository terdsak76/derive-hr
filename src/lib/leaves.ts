export const leavePeriodLabels: Record<string, string> = {
  FULL_DAY: 'ทั้งวัน',
  MORNING: 'ครึ่งเช้า',
  AFTERNOON: 'ครึ่งบ่าย',
};

export function countLeaveDays(start: Date, end: Date, period: string): number {
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return days * (period === 'MORNING' || period === 'AFTERNOON' ? 0.5 : 1);
}

export function parseLeaveDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
