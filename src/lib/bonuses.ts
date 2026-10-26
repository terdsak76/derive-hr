export type BonusAmounts = { baseCents: number; deductionCents: number; amountCents: number; excessLeaveDays: number };

export function parseBonusYear(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d{4}$/.test(value))) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 9998 ? year : null;
}

/** Count unique approved leave dates; overlapping full/half-day requests cannot double-charge a day. */
export function countBonusLeaveDays(leaves: { startDate: Date; endDate: Date; period: string }[], year: number): number {
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year, 11, 31);
  const days = new Map<number, number>();
  for (const leave of leaves) {
    const first = Math.max(new Date(leave.startDate.toISOString().slice(0, 10)).getTime(), start);
    const last = Math.min(new Date(leave.endDate.toISOString().slice(0, 10)).getTime(), end);
    const mask = leave.period === 'MORNING' ? 1 : leave.period === 'AFTERNOON' ? 2 : 3;
    for (let day = first; day <= last; day += 86400000) days.set(day, (days.get(day) || 0) | mask);
  }
  return Array.from(days.values()).reduce((total, mask) => total + (mask === 3 ? 1 : 0.5), 0);
}

export function calculateBonusCents(salaryCents: number, score: number, leaveDays: number, maxLeaveDays: number): BonusAmounts {
  if (!Number.isSafeInteger(salaryCents) || salaryCents < 0 || !Number.isFinite(score) || score < 0 || score > 200 ||
      !Number.isFinite(leaveDays) || leaveDays < 0 || !Number.isFinite(maxLeaveDays) || maxLeaveDays < 0) throw new Error('Invalid bonus inputs');
  const excessLeaveDays = Math.max(0, leaveDays - maxLeaveDays);
  const baseCents = Math.round(salaryCents * score / 100);
  const deductionCents = Math.round(salaryCents * excessLeaveDays / 22);
  return { baseCents, deductionCents, amountCents: Math.max(0, baseCents - deductionCents), excessLeaveDays };
}
