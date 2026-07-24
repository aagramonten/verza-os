/**
 * Financials application errors. The presentation layer maps these to
 * problem+json. A NotFoundError is returned for both missing and
 * cross-tenant resources so tenant boundaries never leak existence.
 */

export class ResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'ResourceNotFoundError';
  }
}

export class InvalidInputError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'InvalidInputError';
  }
}

export class QuoteConflictError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'QuoteConflictError';
  }
}

export class QuotePermissionError extends Error {
  constructor(detail = 'A human OWNER or ADMIN is required for this quote action') {
    super(detail);
    this.name = 'QuotePermissionError';
  }
}
