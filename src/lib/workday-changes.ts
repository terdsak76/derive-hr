const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isWorkdayTimeRange(start: unknown, end: unknown): boolean {
  return typeof start === 'string' && typeof end === 'string' &&
    timePattern.test(start) && timePattern.test(end) && start < end;
}

export function workdayTimeRange(start?: string | null, end?: string | null): string {
  return start && end ? `${start}–${end} น.` : 'ไม่ระบุเวลา';
}

export function parseWorkdayDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
