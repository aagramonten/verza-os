import type { Clock } from '../application/ports.js';

/** Real wall-clock time. Tests substitute a fixed clock via the Clock port. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
