/**
 * Calendar-month boundaries. Puerto Rico observes no DST (fixed UTC-4), so a
 * constant offset yields correct local month buckets without a tz database.
 * Returns the half-open UTC interval [start, end) for the month containing
 * `now` in local time.
 */
export const PR_UTC_OFFSET_HOURS = -4;

export interface MonthRange {
  /** e.g. "2026-07" */
  label: string;
  start: Date;
  end: Date;
}

export function monthRange(now: Date, offsetHours: number = PR_UTC_OFFSET_HOURS): MonthRange {
  const offsetMs = offsetHours * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();

  // Local wall-clock month start/end converted back to the UTC instant.
  const start = new Date(Date.UTC(year, month, 1) - offsetMs);
  const end = new Date(Date.UTC(year, month + 1, 1) - offsetMs);
  const label = `${year}-${String(month + 1).padStart(2, '0')}`;

  return { label, start, end };
}
