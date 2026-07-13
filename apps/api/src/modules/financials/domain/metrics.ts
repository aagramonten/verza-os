/**
 * Pure, deterministic ratio helpers for financial metrics. Kept free of any
 * framework/Prisma dependency so they can be unit-tested in isolation. All
 * callers pass integer cents; percentages are returned rounded to one decimal.
 */

/** Percentage `numerator / denominator * 100`, or null when denominator ≤ 0. */
export function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Integer-cent average `total / count`, or null when count ≤ 0. */
export function averageCents(totalCents: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }
  return Math.round(totalCents / count);
}

/** True when a value meets or exceeds a goal (null values never meet a goal). */
export function meetsGoal(value: number | null, goal: number): boolean {
  return value !== null && value >= goal;
}
