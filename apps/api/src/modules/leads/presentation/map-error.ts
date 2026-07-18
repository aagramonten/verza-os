import { ZodError } from 'zod';
import { HttpError } from '../../../shared/http/problem.js';
import { LeadNotFoundError } from '../application/errors.js';

/** Translate application errors into problem+json HttpErrors. */
export function mapError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new HttpError(400, 'Bad Request', 'Invalid request');
  }
  if (error instanceof LeadNotFoundError) {
    return new HttpError(404, 'Not Found', error.message);
  }
  return error;
}
