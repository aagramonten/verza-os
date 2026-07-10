import pino from 'pino';
import { loadEnv } from './config/env.js';
import { createPrismaClient } from './shared/prisma.js';
import { buildApp } from './app.js';

const logger = pino({
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-resume-token"]'],
    remove: true,
  },
});

async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  await prisma.$connect();

  const app = buildApp({ env, prisma, logger });
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'verza-api listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'fatal: api failed to start');
  process.exit(1);
});
