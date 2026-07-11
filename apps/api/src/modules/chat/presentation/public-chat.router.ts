import { createHash } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuditLogService } from '../../../shared/audit/audit-log.service.js';
import { HttpError } from '../../../shared/http/problem.js';
import { MessageRejectedError } from '../../../shared/text/sanitize.js';
import {
  ChatSessionNotFoundError,
  ConfirmationNotAvailableError,
  InvalidResumeTokenError,
  SessionClosedError,
} from '../domain/errors.js';
import { InvalidStateTransitionError } from '../domain/state-machine.js';
import type { PublicChatService } from '../application/public-chat.service.js';
import type { RateLimiter } from '../application/ports.js';
import {
  resumeSchema,
  resumeTokenHeaderSchema,
  sendMessageSchema,
  sessionIdSchema,
} from './schemas.js';

export interface PublicChatRouterDeps {
  service: PublicChatService;
  rateLimiter: RateLimiter;
  audit: AuditLogService;
}

/** PII-safe request identity: IPs are hashed before storage or audit. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 32);
}

const RESUME_TOKEN_HEADER = 'x-resume-token';

/**
 * Public chat controller. Zero business logic: validate → delegate → map.
 * Domain errors are translated to problem+json here; nothing else leaks.
 */
export function createPublicChatRouter(deps: PublicChatRouterDeps): Router {
  const router = Router();

  router.use(async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? 'unknown';
    const verdict = deps.rateLimiter.hit(ip);
    if (!verdict.allowed) {
      await deps.audit.record({
        actorType: 'SYSTEM',
        action: 'chat.rate_limit.exceeded',
        entity: 'chat_session',
        entityId: 'n/a',
        data: { ipHash: hashIp(ip), retryAfterSeconds: verdict.retryAfterSeconds },
      });
      res
        .status(429)
        .contentType('application/problem+json')
        .setHeader('Retry-After', String(verdict.retryAfterSeconds))
        .json({
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Rate limit exceeded. Please retry later.',
        });
      return;
    }
    next();
  });

  router.post('/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await deps.service.createSession({
        ipHash: hashIp(req.ip ?? 'unknown'),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      });
      res.status(201).json(created);
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/sessions/:sessionId/messages', async (req, res, next) => {
    try {
      const sessionId = sessionIdSchema.parse(req.params['sessionId']);
      const token = requireToken(req);
      const body = sendMessageSchema.parse(req.body);
      const result = await deps.service.appendCustomerMessage(sessionId, token, body.message);
      res.status(201).json(result);
    } catch (error) {
      next(mapError(error));
    }
  });

  router.get('/sessions/:sessionId', async (req, res, next) => {
    try {
      const sessionId = sessionIdSchema.parse(req.params['sessionId']);
      const token = requireToken(req);
      res.json(await deps.service.getSession(sessionId, token));
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/sessions/:sessionId/resume', async (req, res, next) => {
    try {
      const sessionId = sessionIdSchema.parse(req.params['sessionId']);
      const body = resumeSchema.parse(req.body);
      res.json(await deps.service.resumeSession(sessionId, body.resumeToken));
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/sessions/:sessionId/confirm', async (req, res, next) => {
    try {
      const sessionId = sessionIdSchema.parse(req.params['sessionId']);
      const token = requireToken(req);
      res.status(201).json(await deps.service.confirmSummary(sessionId, token));
    } catch (error) {
      next(mapError(error));
    }
  });

  router.post('/sessions/:sessionId/correct', async (req, res, next) => {
    try {
      const sessionId = sessionIdSchema.parse(req.params['sessionId']);
      const token = requireToken(req);
      res.status(201).json(await deps.service.correctSummary(sessionId, token));
    } catch (error) {
      next(mapError(error));
    }
  });

  router.get('/sessions/:sessionId/status', async (req, res, next) => {
    try {
      const sessionId = sessionIdSchema.parse(req.params['sessionId']);
      const token = requireToken(req);
      res.json(await deps.service.getStatus(sessionId, token));
    } catch (error) {
      next(mapError(error));
    }
  });

  return router;
}

function requireToken(req: Request): string {
  const header = req.headers[RESUME_TOKEN_HEADER];
  const parsed = resumeTokenHeaderSchema.safeParse(header);
  if (!parsed.success) {
    throw new HttpError(401, 'Unauthorized', 'A valid resume token is required');
  }
  return parsed.data;
}

function mapError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof ChatSessionNotFoundError) {
    return new HttpError(404, 'Not Found', 'Chat session not found');
  }
  if (error instanceof InvalidResumeTokenError) {
    // Single opaque message for every token failure mode — no oracle.
    return new HttpError(401, 'Unauthorized', 'Resume token is not valid for this session');
  }
  if (error instanceof SessionClosedError) {
    return new HttpError(409, 'Conflict', 'This conversation is closed');
  }
  if (error instanceof ConfirmationNotAvailableError) {
    return new HttpError(409, 'Conflict', 'This session is not ready for confirmation');
  }
  if (error instanceof InvalidStateTransitionError) {
    return new HttpError(409, 'Conflict', 'The requested state change is not allowed');
  }
  if (error instanceof MessageRejectedError) {
    return new HttpError(
      422,
      'Unprocessable Entity',
      error.reason === 'empty' ? 'Message is empty' : 'Message exceeds the maximum length',
    );
  }
  if (isZodError(error)) {
    return new HttpError(400, 'Bad Request', 'Request validation failed');
  }
  return error;
}

function isZodError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ZodError';
}
