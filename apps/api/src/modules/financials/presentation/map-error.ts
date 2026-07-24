import { ZodError } from 'zod';
import { HttpError } from '../../../shared/http/problem.js';
import {
  InvalidInputError,
  QuoteConflictError,
  QuotePermissionError,
  ResourceNotFoundError,
} from '../application/errors.js';
import { MoneyError } from '../domain/money.js';
import { QuoteDomainError } from '../domain/quote.js';

/** Translate application/domain errors into problem+json HttpErrors. */
export function mapError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new HttpError(400, 'Bad Request', 'Invalid request');
  }
  if (error instanceof QuoteDomainError && error.code === 'HUMAN_ACTOR_REQUIRED') {
    return new HttpError(403, 'Forbidden', error.message);
  }
  if (
    error instanceof MoneyError ||
    error instanceof InvalidInputError ||
    (error instanceof QuoteDomainError && error.code !== 'INVALID_TRANSITION')
  ) {
    return new HttpError(400, 'Bad Request', error.message);
  }
  if (error instanceof ResourceNotFoundError) {
    return new HttpError(404, 'Not Found', error.message);
  }
  if (
    error instanceof QuoteConflictError ||
    (error instanceof QuoteDomainError && error.code === 'INVALID_TRANSITION')
  ) {
    return new HttpError(409, 'Conflict', error.message);
  }
  if (error instanceof QuotePermissionError) {
    return new HttpError(403, 'Forbidden', error.message);
  }
  return error;
}
