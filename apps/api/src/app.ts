import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import pino, { type Logger } from 'pino';
import type { PrismaClient } from '@prisma/client';
import type { Env } from './config/env.js';
import { errorHandler, notFoundHandler } from './shared/http/problem.js';
import { createChatModule, type ChatModuleOverrides } from './modules/chat/index.js';
import { createAuthModule, type AuthModuleOverrides } from './modules/auth/index.js';
import { createFinancialsModule } from './modules/financials/index.js';
import { createLeadsModule } from './modules/leads/index.js';

export interface AppDependencies {
  env: Env;
  prisma: PrismaClient;
  logger?: Logger;
  chatOverrides?: ChatModuleOverrides;
  authOverrides?: AuthModuleOverrides;
}

export const API_VERSION = '0.1.0';

interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  environment: Env['NODE_ENV'];
  database: 'connected' | 'disconnected';
}

/**
 * Express app factory. All dependencies are injected so tests can construct
 * the app against their own database and configuration.
 */
export function buildApp({
  env,
  prisma,
  logger,
  chatOverrides,
  authOverrides,
}: AppDependencies): Express {
  const log =
    logger ??
    pino({
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: {
        // Raw resume tokens must never reach the logs (Day 2 spec).
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-resume-token"]'],
        remove: true,
      },
    });

  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger: log,
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );

  app.get('/health', async (_req: Request, res: Response) => {
    let database: HealthResponse['database'] = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch (error) {
      log.error({ err: error }, 'health check: database unreachable');
    }

    const body: HealthResponse = {
      status: database === 'connected' ? 'ok' : 'degraded',
      version: API_VERSION,
      environment: env.NODE_ENV,
      database,
    };
    res.status(database === 'connected' ? 200 : 503).json(body);
  });

  const chat = createChatModule(env, prisma, chatOverrides ?? {});
  app.use('/api/v1/public/chat', chat.router);

  const auth = createAuthModule(env, prisma, authOverrides ?? {});
  app.use('/api/v1/auth', auth.router);

  const financials = createFinancialsModule(env, prisma, { authenticate: auth.authenticate });
  app.use('/api/v1', financials.router);

  const leads = createLeadsModule(env, prisma, { authenticate: auth.authenticate });
  app.use('/api/v1', leads.router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
