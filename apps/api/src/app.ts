import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import pino, { type Logger } from 'pino';
import type { PrismaClient } from '@prisma/client';
import type { Env } from './config/env.js';
import { errorHandler, notFoundHandler } from './shared/http/problem.js';

export interface AppDependencies {
  env: Env;
  prisma: PrismaClient;
  logger?: Logger;
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
export function buildApp({ env, prisma, logger }: AppDependencies): Express {
  const log =
    logger ??
    pino({
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], remove: true },
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
