import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../../../shared/http/problem.js';
import type { AccessTokenIssuer } from '../application/ports.js';
import { InvalidAccessTokenError } from '../application/errors.js';
import './types.js';

const BEARER = /^Bearer (.+)$/;

/**
 * Verifies the `Authorization: Bearer <jwt>` access token and attaches the
 * resulting AuthContext to `req.auth`. The tenant (companyId) and role come
 * from the signed token only — never from request headers or body.
 */
export function createAuthenticate(issuer: AccessTokenIssuer): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? BEARER.exec(header) : null;
    if (!match) {
      next(new HttpError(401, 'Unauthorized', 'Missing bearer token'));
      return;
    }

    try {
      req.auth = issuer.verify(match[1] as string);
      next();
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) {
        next(new HttpError(401, 'Unauthorized', 'Invalid or expired access token'));
        return;
      }
      next(error);
    }
  };
}
