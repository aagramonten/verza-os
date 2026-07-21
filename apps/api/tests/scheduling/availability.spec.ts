import { describe, expect, it } from 'vitest';
import {
  computeSlots,
  findConflicts,
  type Interval,
  type Window,
} from '../../src/modules/scheduling/domain/availability.js';

// PR local time is UTC-4. Helper: build the UTC instant for a PR wall-clock time.
// UTC = local + 4h.
function prLocal(day: number, hh: number, mm = 0): Date {
  return new Date(Date.UTC(2026, 6, day, hh + 4, mm));
}

// 2026-07-20 is a Monday (weekday 1). Working window Mon 8:00–16:00.
const MONDAY = 20;
const mondayWindow: Window = { weekday: 1, startMinute: 8 * 60, endMinute: 16 * 60 };

describe('computeSlots', () => {
  it('marks every slot inside a working window free when nothing is booked', () => {
    const slots = computeSlots({
      from: prLocal(MONDAY, 8),
      to: prLocal(MONDAY, 12),
      windows: [mondayWindow],
      blocks: [],
      appointments: [],
      slotMinutes: 60,
      visitMinutes: 60,
    });
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.free)).toBe(true);
  });

  it('marks a slot busy when it overlaps an active appointment', () => {
    const appt: Interval = { startAt: prLocal(MONDAY, 9), endAt: prLocal(MONDAY, 10) };
    const slots = computeSlots({
      from: prLocal(MONDAY, 8),
      to: prLocal(MONDAY, 12),
      windows: [mondayWindow],
      blocks: [],
      appointments: [appt],
      slotMinutes: 60,
      visitMinutes: 60,
    });
    // 8–9 free, 9–10 busy, 10–11 free, 11–12 free
    expect(slots.map((s) => s.free)).toEqual([true, false, true, true]);
  });

  it('marks slots outside the working window as not free', () => {
    const slots = computeSlots({
      from: prLocal(MONDAY, 6),
      to: prLocal(MONDAY, 9),
      windows: [mondayWindow],
      blocks: [],
      appointments: [],
      slotMinutes: 60,
      visitMinutes: 60,
    });
    // 6–7 and 7–8 outside hours, 8–9 inside
    expect(slots.map((s) => s.free)).toEqual([false, false, true]);
  });

  it('treats a block like a busy interval', () => {
    const block: Interval = { startAt: prLocal(MONDAY, 10), endAt: prLocal(MONDAY, 11, 30) };
    const slots = computeSlots({
      from: prLocal(MONDAY, 8),
      to: prLocal(MONDAY, 12),
      windows: [mondayWindow],
      blocks: [block],
      appointments: [],
      slotMinutes: 60,
      visitMinutes: 60,
    });
    // 10–11 and 11–12 both overlap the 10:00–11:30 block
    expect(slots.map((s) => s.free)).toEqual([true, true, false, false]);
  });
});

describe('findConflicts', () => {
  it('returns no conflicts for a clean slot inside working hours', () => {
    const conflicts = findConflicts({
      scheduledAt: prLocal(MONDAY, 8),
      durationMin: 60,
      windows: [mondayWindow],
      blocks: [],
      appointments: [],
    });
    expect(conflicts).toEqual([]);
  });

  it('flags an overlapping appointment', () => {
    const conflicts = findConflicts({
      scheduledAt: prLocal(MONDAY, 9, 30),
      durationMin: 60,
      windows: [mondayWindow],
      blocks: [],
      appointments: [{ startAt: prLocal(MONDAY, 9), endAt: prLocal(MONDAY, 10) }],
    });
    expect(conflicts.map((c) => c.kind)).toContain('appointment');
  });

  it('flags a visit outside working hours', () => {
    const conflicts = findConflicts({
      scheduledAt: prLocal(MONDAY, 7),
      durationMin: 60,
      windows: [mondayWindow],
      blocks: [],
      appointments: [],
    });
    expect(conflicts.map((c) => c.kind)).toEqual(['outside-hours']);
  });

  it('flags a visit that runs past the end of the window', () => {
    const conflicts = findConflicts({
      scheduledAt: prLocal(MONDAY, 15, 30),
      durationMin: 60, // 15:30–16:30, window ends 16:00
      windows: [mondayWindow],
      blocks: [],
      appointments: [],
    });
    expect(conflicts.map((c) => c.kind)).toContain('outside-hours');
  });

  it('does not flag working hours when no windows are configured', () => {
    const conflicts = findConflicts({
      scheduledAt: prLocal(MONDAY, 3),
      durationMin: 60,
      windows: [],
      blocks: [],
      appointments: [],
    });
    expect(conflicts).toEqual([]);
  });
});
