export const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
export const OT_WORKING_HOURS = 176;
export const OT_MULTIPLIER_NUMERATOR = 3;
export const OT_MULTIPLIER_DENOMINATOR = 2;

export type OvertimeCalculation = {
  workedMinutes: number;
  hourlyRateCents: number;
  otAmountCents: number;
};

export function parseBangkokDateTime(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  // datetime-local normally emits YYYY-MM-DDTHH:mm, but browsers may retain
  // a seconds component when a value is typed or restored from form state.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '00'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 ||
    second < 0 || second > 59
  ) {
    return null;
  }

  // Bangkok is UTC+07:00. Construct UTC explicitly instead of relying on the
  // operating system timezone of the Next.js server.
  const date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const actual = Object.fromEntries(parts.map(part => [part.type, part.value]));
  if (
    actual.year !== yearText || actual.month !== monthText || actual.day !== dayText ||
    actual.hour !== hourText || actual.minute !== minuteText ||
    actual.second !== secondText
  ) return null;
  return date;
}

function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (2 * denominator));
}

export function calculateOvertime(
  salaryCents: number,
  startAt: Date,
  endAt: Date,
): OvertimeCalculation | null {
  if (!Number.isSafeInteger(salaryCents) || salaryCents <= 0) return null;
  const durationMs = endAt.getTime() - startAt.getTime();
  if (durationMs <= 0 || durationMs % 60_000 !== 0) return null;

  const workedMinutes = durationMs / 60_000;
  // salary / 176 * 1.5 = salary * 3 / 352. Keep the rate rational until the
  // final monetary rounding so duration and salary are never binary floats.
  const rateDenominator = OT_WORKING_HOURS * OT_MULTIPLIER_DENOMINATOR;
  const rateNumerator = salaryCents * OT_MULTIPLIER_NUMERATOR;
  const hourlyRateCents = roundHalfUp(rateNumerator, rateDenominator);
  const otAmountCents = roundHalfUp(
    rateNumerator * workedMinutes,
    rateDenominator * 60,
  );

  return { workedMinutes, hourlyRateCents, otAmountCents };
}

export function formatBangkokDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(',', '');
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}
