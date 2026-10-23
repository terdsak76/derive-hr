// Store baht as integer satang and round the calculated monthly payment once.
export function calculateIncentiveCents(fullIncentiveCents: number, score: number): number {
  return Math.round(fullIncentiveCents * score / 100);
}
