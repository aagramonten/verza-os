import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../../../shared/http/problem.js';
import {
  InvalidCustomerAuthTokenError,
  InvalidCustomerSessionError,
} from '../application/errors.js';
import { normalizeCustomerIdentifier } from '../application/customer-identifier.js';
import type { CustomerAuthService } from '../application/customer-auth.service.js';
import type { CustomerPiiHasher, RateLimiter } from '../application/ports.js';
import { requireCustomerBearer } from '../middleware/authenticate-customer.js';
import { requestAccessSchema, verifyAccessSchema } from './schemas.js';
import '../middleware/types.js';

export interface CustomerAuthRouterDeps {
  service: CustomerAuthService;
  authenticate: RequestHandler;
  piiHasher: CustomerPiiHasher;
  requestLimiter: RateLimiter;
  verifyLimiter: RateLimiter;
}

const GENERIC_REQUEST_RESPONSE = {
  message: 'Si encontramos una cuenta, enviaremos un enlace de acceso.',
} as const;

export function createCustomerAuthRouter(deps: CustomerAuthRouterDeps): Router {
  const router = Router();

  router.post('/request', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = requestAccessSchema.parse(req.body);
      const ipHash = deps.piiHasher.hash(req.ip ?? 'unknown', 'ip');
      const identifierHash = deps.piiHasher.hash(
        normalizeCustomerIdentifier(body.identifier).value,
        'identifier',
      );
      const retryAfter = retryAfterFor(deps.requestLimiter, [
        `ip:${ipHash}`,
        `identifier:${identifierHash}`,
      ]);
      if (retryAfter > 0) {
        sendRateLimit(res, retryAfter);
        return;
      }
      await deps.service.requestAccess({ identifier: body.identifier, ipHash });
      res.status(202).json(GENERIC_REQUEST_RESPONSE);
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ipHash = deps.piiHasher.hash(req.ip ?? 'unknown', 'ip');
      const retryAfter = retryAfterFor(deps.verifyLimiter, [`ip:${ipHash}`]);
      if (retryAfter > 0) {
        sendRateLimit(res, retryAfter);
        return;
      }
      const body = verifyAccessSchema.parse(req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(
        await deps.service.verify({
          token: body.token,
          ipHash,
          userAgent: userAgentOf(req),
        }),
      );
    } catch (error) {
      next(mapError(error));
    }
  });

  router.get('/me', deps.authenticate, async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ customer: await deps.service.me(req.customerAuth!) });
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/logout', deps.authenticate, async (req, res, next) => {
    try {
      const raw = requireCustomerBearer(req);
      if (!raw) throw new InvalidCustomerSessionError();
      await deps.service.logout(raw, req.customerAuth!);
      res.status(204).send();
    } catch (error) {
      next(mapError(error));
    }
  });

  return router;
}

function retryAfterFor(limiter: RateLimiter, keys: string[]): number {
  let retryAfterSeconds = 0;
  for (const key of keys) {
    const verdict = limiter.hit(key);
    if (!verdict.allowed) {
      retryAfterSeconds = Math.max(retryAfterSeconds, verdict.retryAfterSeconds);
    }
  }
  return retryAfterSeconds;
}

function sendRateLimit(res: Response, retryAfterSeconds: number): void {
  res
    .status(429)
    .contentType('application/problem+json')
    .setHeader('Retry-After', String(retryAfterSeconds))
    .json({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many access attempts. Try again later.',
    });
}

function userAgentOf(req: Request): string | null {
  const value = req.headers['user-agent'];
  return typeof value === 'string' ? value.slice(0, 191) : null;
}

function mapError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new HttpError(400, 'Bad Request', 'Invalid request body');
  }
  if (
    error instanceof InvalidCustomerAuthTokenError ||
    error instanceof InvalidCustomerSessionError
  ) {
    return new HttpError(401, 'Unauthorized', 'Invalid or expired access');
  }
  return error;
}
