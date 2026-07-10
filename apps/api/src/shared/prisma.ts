import { PrismaClient } from '@prisma/client';

/**
 * Prisma client factory. A single instance is created in main.ts and injected
 * into the app factory (constructor injection keeps tests able to substitute
 * their own client/database).
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ['warn', 'error'],
  });
}
