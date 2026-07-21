/**
 * Scheduling application errors. A single NotFoundError covers both missing and
 * cross-tenant resources so tenant boundaries never leak existence.
 */

export class SchedulingNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'SchedulingNotFoundError';
  }
}

export class InvalidSchedulingInputError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'InvalidSchedulingInputError';
  }
}
