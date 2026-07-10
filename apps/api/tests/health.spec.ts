import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { createPrismaClient } from '../src/shared/prisma.js';
import { testEnv } from './helpers/test-env.js';

describe('GET /health', () => {
  const env = testEnv();
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports ok with a connected database', async () => {
    const app = buildApp({ env, prisma });
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      version: '0.1.0',
      environment: 'test',
      database: 'connected',
    });
  });

  it('returns problem+json for unknown routes', async () => {
    const app = buildApp({ env, prisma });
    const response = await request(app).get('/nope');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.title).toBe('Not Found');
  });
});
