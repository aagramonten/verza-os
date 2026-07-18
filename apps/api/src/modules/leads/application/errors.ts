/**
 * Leads application errors. A single NotFoundError covers both missing and
 * cross-tenant leads so tenant boundaries never leak existence.
 */

export class LeadNotFoundError extends Error {
  constructor() {
    super('Lead not found');
    this.name = 'LeadNotFoundError';
  }
}
