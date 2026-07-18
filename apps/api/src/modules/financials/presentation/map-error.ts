import { ZodError } from 'zod';
import { HttpError } from '../../../shared/http/problem.js';
import { InvalidInputError, ResourceNotFoundError } from '../application/errors.js';
import { MoneyError } from '../domain/money.js';

/** Translate application/domain errors into problem+json HttpErrors. */
export function mapError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new HttpError(400, 'Bad Request', 'Invalid request');
  }
  if (error instanceof MoneyError || error instanceof InvalidInputError) {
    return new HttpError(400, 'Bad Request', error.message);
  }
  if (error instanceof ResourceNotFoundError) {
    return new HttpError(404, 'Not Found', error.message);
  }
  return error;
}
