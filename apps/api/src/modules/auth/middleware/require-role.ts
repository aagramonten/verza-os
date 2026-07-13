import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { HttpError } from '../../../shared/http/problem.js';
import './types.js';

/**
 * RBAC guard. Must run AFTER `authenticate`. Rejects with 403 when the
 * caller's role is not in the allow-list; 401 if somehow unauthenticated.
 * Financial routes gate on OWNER/ADMIN (BUSINESS_RULES §Financials).
 */
export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError(401, 'Unauthorized', 'Authentication required'));
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      next(new HttpError(403, 'Forbidden', 'Insufficient permissions'));
      return;
    }
    next();
  };
}
