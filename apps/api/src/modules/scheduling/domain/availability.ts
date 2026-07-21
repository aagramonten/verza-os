/**
 * Availability computation for the owner agenda.
 *
 * All wall-clock reasoning is done in Puerto Rico local time, which is a fixed
 * UTC-4 with no DST — the same assumption the financials module relies on
 * (see financials/domain/period.ts). `scheduledAt`/block instants are stored in
 * UTC; weekly windows are stored as local weekday + minute-of-day.
 *
 * These functions are pure (no DB, no clock) so they are trivially testable.
 */

export const PR_UTC_OFFSET_HOURS = -4;
const MS_PER_MIN = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

export interface Window {
  /** 0 = Sunday .. 6 = Saturday, in PR local time. */
  weekday: number;
  /** Minutes from local midnight. */
  startMinute: number;
  endMinute: number;
}

export interface Interval {
  startAt: Date;
  endAt: Date;
}

export interface Slot {
  startAt: Date;
  endAt: Date;
  free: boolean;
}

export interface ComputeSlotsInput {
  /** Half-open UTC range [from, to) to lay slots over. */
  from: Date;
  to: Date;
  windows: Window[];
  blocks: Interval[];
  /** Active (non-cancelled) appointments as intervals. */
  appointments: Interval[];
  slotMinutes: number;
  /** Length of the visit a slot must be able to host to count as free. */
  visitMinutes: number;
  offsetHours?: number;
}

/** Local wall-clock parts of a UTC instant, in PR local time. */
function localParts(instant: Date, offsetHours: number): { weekday: number; minuteOfDay: number; dayStartUtc: Date } {
  const local = new Date(instant.getTime() + offsetHours * 60 * MS_PER_MIN);
  const weekday = local.getUTCDay();
  const minuteOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dayStartLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const dayStartUtc = new Date(dayStartLocal - offsetHours * 60 * MS_PER_MIN);
  return { weekday, minuteOfDay, dayStartUtc };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** True if [start, end) sits entirely inside one of the weekly working windows. */
function withinWindow(start: Date, end: Date, windows: Window[], offsetHours: number): boolean {
  const s = localParts(start, offsetHours);
  const e = localParts(end, offsetHours);
  // A slot never spans local midnight (slots are minutes long), so same day.
  if (s.dayStartUtc.getTime() !== e.dayStartUtc.getTime()) return false;
  const endMinute = e.minuteOfDay === 0 ? 24 * 60 : e.minuteOfDay;
  return windows.some(
    (w) => w.weekday === s.weekday && s.minuteOfDay >= w.startMinute && endMinute <= w.endMinute,
  );
}

/**
 * Lay `slotMinutes` slots across [from, to) and mark each free/busy. A slot is
 * free when it fits inside a working window and overlaps no block or active
 * appointment.
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const offsetHours = input.offsetHours ?? PR_UTC_OFFSET_HOURS;
  const step = input.slotMinutes * MS_PER_MIN;
  const busy = [...input.blocks, ...input.appointments];
  const slots: Slot[] = [];

  for (let t = input.from.getTime(); t + step <= input.to.getTime(); t += step) {
    const startAt = new Date(t);
    const endAt = new Date(t + step);
    const inWindow = withinWindow(startAt, endAt, input.windows, offsetHours);
    const clashes = busy.some((b) => overlaps(startAt, endAt, b.startAt, b.endAt));
    slots.push({ startAt, endAt, free: inWindow && !clashes });
  }
  return slots;
}

export interface Conflict {
  kind: 'appointment' | 'block' | 'outside-hours';
  startAt: Date;
  endAt: Date;
}

export interface FindConflictsInput {
  scheduledAt: Date;
  durationMin: number;
  windows: Window[];
  blocks: Interval[];
  appointments: Interval[];
  offsetHours?: number;
}

/**
 * Returns every reason the proposed visit is problematic: overlapping
 * appointments, overlapping blocks, and whether it falls outside working hours.
 * Empty array means the slot is clean. The caller decides whether to warn or
 * proceed — conflicts never hard-block (the owner may override).
 */
export function findConflicts(input: FindConflictsInput): Conflict[] {
  const offsetHours = input.offsetHours ?? PR_UTC_OFFSET_HOURS;
  const start = input.scheduledAt;
  const end = new Date(start.getTime() + input.durationMin * MS_PER_MIN);
  const conflicts: Conflict[] = [];

  for (const a of input.appointments) {
    if (overlaps(start, end, a.startAt, a.endAt)) {
      conflicts.push({ kind: 'appointment', startAt: a.startAt, endAt: a.endAt });
    }
  }
  for (const b of input.blocks) {
    if (overlaps(start, end, b.startAt, b.endAt)) {
      conflicts.push({ kind: 'block', startAt: b.startAt, endAt: b.endAt });
    }
  }
  if (input.windows.length > 0 && !withinWindow(start, end, input.windows, offsetHours)) {
    conflicts.push({ kind: 'outside-hours', startAt: start, endAt: end });
  }
  return conflicts;
}

/** Half-open UTC range covering the local day(s) that `from`..`to` touch — a
 *  small helper for callers that think in whole days. Exposed for tests. */
export { MS_PER_DAY };
