/** All application calendar dates and defaults use Bangkok, regardless of the
 * browser/server timezone. Keep ISO timestamps intact for storage and transport.
 * Date-only fields (leave, workday and salary effective dates) are calendar
 * labels stored at UTC midnight; do not reinterpret them as Bangkok midnight.
 */
export const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BANGKOK_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function formatBangkokDate(date: Date = new Date()): string {
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function bangkokMonth(date: Date = new Date()): string {
  return formatBangkokDate(date).slice(0, 7);
}

export function bangkokYear(date: Date = new Date()): number {
  return Number(formatBangkokDate(date).slice(0, 4));
}

export function bangkokDateAfter(days: number, date: Date = new Date()): string {
  // Bangkok has no daylight saving changes, so each calendar day is 24 hours.
  return formatBangkokDate(new Date(date.getTime() + days * 86_400_000));
}
