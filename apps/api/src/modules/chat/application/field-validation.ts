import { z } from 'zod';

/**
 * Application-code validators for values the AI proposes. The AI may suggest
 * these, but the server computes/validates them — never trusting raw model
 * numbers, dates, emails, or phone strings.
 */

const emailSchema = z.string().email().max(254);

export function validateEmail(raw: string | null): string | null {
  if (raw === null) return null;
  const result = emailSchema.safeParse(raw.trim().toLowerCase());
  return result.success ? result.data : null;
}

/** Returns a canonical YYYY-MM-DD string or null. Rejects absurd/past-far dates. */
export function validateDesiredDate(raw: string | null, now: Date): string | null {
  if (raw === null) return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(raw.trim());
  if (match === null) return null;
  const parsed = new Date(`${raw.trim()}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const minYear = now.getUTCFullYear() - 1;
  const maxYear = now.getUTCFullYear() + 5;
  const year = parsed.getUTCFullYear();
  return year >= minYear && year <= maxYear ? raw.trim() : null;
}

const MAX_DIMENSION_FT = 10_000;
const MIN_DIMENSION_FT = 0.5;

/** Square footage is ALWAYS computed here, never taken from the AI. */
export function computeSquareFeet(lengthFt: number | null, widthFt: number | null): number | null {
  if (lengthFt === null || widthFt === null) return null;
  if (
    lengthFt < MIN_DIMENSION_FT ||
    widthFt < MIN_DIMENSION_FT ||
    lengthFt > MAX_DIMENSION_FT ||
    widthFt > MAX_DIMENSION_FT
  ) {
    return null;
  }
  return Math.round(lengthFt * widthFt * 100) / 100;
}

export function sanitizeDimension(value: number | null): number | null {
  if (value === null) return null;
  if (value < MIN_DIMENSION_FT || value > MAX_DIMENSION_FT) return null;
  return Math.round(value * 100) / 100;
}

const MAX_BUDGET_CENTS = 100_000_000; // $1,000,000 ceiling

export function clampBudgetCents(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > MAX_BUDGET_CENTS) return null;
  return value;
}

/** Reported square feet from the customer, bounded but not multiplied. */
export function sanitizeReportedSqFt(value: number | null): number | null {
  if (value === null) return null;
  if (value <= 0 || value > MAX_DIMENSION_FT * MAX_DIMENSION_FT) return null;
  return Math.round(value * 100) / 100;
}
