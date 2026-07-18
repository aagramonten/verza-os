import { createHash } from 'node:crypto';
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../../../shared/http/problem.js';
import type { AuthService } from '../application/auth.service.js';
import {
  InvalidAccessTokenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenReuseError,
} from '../application/errors.js';
import type { LoginRateLimiter } from '../infrastructure/in-memory-login-rate-limiter.js';
import { loginSchema, logoutSchema, refreshSchema } from './schemas.js';
import '../middleware/types.js';

export interface AuthRouterDeps {
  service: AuthService;
  authenticate: RequestHandler;
  loginRateLimiter: LoginRateLimiter;
}

/** PII-safe request identity: IPs are hashed before storage or audit. */
function hashIp(ip: string): string {
  return createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 32);
}

function userAgentOf(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

/**
 * Auth controller. Zero business logic: validate → delegate → map. Domain
 * errors become problem+json here; credential/token failures return a single
 * generic 401 so the API never reveals which factor failed.
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? 'unknown';
    const verdict = deps.loginRateLimiter.hit(ip);
    if (!verdict.allowed) {
      res
        .status(429)
        .contentType('application/problem+json')
        .setHeader('Retry-After', String(verdict.retryAfterSeconds))
        .json({
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many login attempts. Please retry later.',
        });
      return;
    }

    try {
      const body = loginSchema.parse(req.body);
      const result = await deps.service.login({
        email: body.email,
        password: body.password,
        ipHash: hashIp(ip),
        userAgent: userAgentOf(req),
      });
      res.status(200).json(result);
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = refreshSchema.parse(req.body);
      const result = await deps.service.refresh({
        refreshToken: body.refreshToken,
        ipHash: hashIp(req.ip ?? 'unknown'),
        userAgent: userAgentOf(req),
      });
      res.status(200).json(result);
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = logoutSchema.parse(req.body);
      await deps.service.logout({ refreshToken: body.refreshToken });
      res.status(204).send();
    } catch (error) {
      next(mapError(error));
    }
  });

  router.get('/me', deps.authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // authenticate guarantees req.auth is present.
      const user = await deps.service.me(req.auth!.userId);
      res.status(200).json({ user });
    } catch (error) {
      next(mapError(error));
    }
  });

  return router;
}

function mapError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new HttpError(400, 'Bad Request', 'Invalid request body');
  }
  if (error instanceof InvalidCredentialsError) {
    return new HttpError(401, 'Unauthorized', 'Invalid email or password');
  }
  if (
    error instanceof InvalidRefreshTokenError ||
    error instanceof RefreshTokenReuseError ||
    error instanceof InvalidAccessTokenError
  ) {
    return new HttpError(401, 'Unauthorized', 'Invalid or expired session');
  }
  return error;
}
