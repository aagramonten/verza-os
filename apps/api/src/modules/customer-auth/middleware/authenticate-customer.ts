import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../../../shared/http/problem.js';
import { InvalidCustomerSessionError } from '../application/errors.js';
import type { CustomerAuthService } from '../application/customer-auth.service.js';
import './types.js';

const BEARER = /^Bearer (.+)$/;

export function requireCustomerBearer(req: Request): string | null {
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? BEARER.exec(header) : null;
  return match?.[1] ?? null;
}

export function createAuthenticateCustomer(service: CustomerAuthService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const raw = requireCustomerBearer(req);
    if (!raw) {
      next(new HttpError(401, 'Unauthorized', 'Missing bearer token'));
      return;
    }
    void service
      .authenticate(raw)
      .then((ctx) => {
        req.customerAuth = ctx;
        next();
      })
      .catch((error: unknown) => {
        if (error instanceof InvalidCustomerSessionError) {
          next(new HttpError(401, 'Unauthorized', 'Invalid or expired session'));
          return;
        }
        next(error);
      });
  };
}
