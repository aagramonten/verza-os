import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { InMemoryRateLimiter } from '../../src/modules/chat/infrastructure/in-memory-rate-limiter.js';
import type { Clock } from '../../src/modules/chat/application/ports.js';
import { testEnv } from '../helpers/test-env.js';

class FixedClock implements Clock {
  now(): Date {
    return new Date('2026-07-10T12:00:00.000Z');
  }
}

// Minimal valid PNG header + IEND — enough to pass magic-byte validation.
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe('public chat media upload', () => {
  const env = testEnv();
  let prisma: PrismaClient;
  let app: Express;
  const sessionIds: string[] = [];
  const leadIds: string[] = [];

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
    app = buildApp({
      env: { ...env, STORAGE_LOCAL_DIR: './uploads-test' },
      prisma,
      chatOverrides: { clock: new FixedClock(), rateLimiter: new InMemoryRateLimiter(1000, new FixedClock()) },
    });
  });

  afterAll(async () => {
    await prisma.leadMedia.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.chatMessage.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.chatSession.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.$disconnect();
  });

  async function newSession(): Promise<{ sessionId: string; token: string }> {
    const res = await request(app).post('/api/v1/public/chat/sessions').send({});
    sessionIds.push(res.body.sessionId);
    const row = await prisma.chatSession.findUniqueOrThrow({
      where: { id: res.body.sessionId },
      select: { leadId: true },
    });
    if (row.leadId !== null) leadIds.push(row.leadId);
    return { sessionId: res.body.sessionId, token: res.body.resumeToken };
  }

  it('accepts a photo, records lead_media, and reports the running count', async () => {
    const { sessionId, token } = await newSession();
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/media`)
      .set('x-resume-token', token)
      .attach('photo', PNG, { filename: 'patio.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.photoCount).toBe(1);
    expect(res.body.mediaId).toBeTruthy();

    const second = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/media`)
      .set('x-resume-token', token)
      .attach('photo', PNG, { filename: 'patio2.png', contentType: 'image/png' });
    expect(second.body.photoCount).toBe(2);

    const stored = await prisma.leadMedia.count({ where: { sessionId } });
    expect(stored).toBe(2);
  });

  it('rejects a non-image file', async () => {
    const { sessionId, token } = await newSession();
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/media`)
      .set('x-resume-token', token)
      .attach('photo', Buffer.from('not an image at all'), {
        filename: 'x.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('requires a valid resume token', async () => {
    const { sessionId } = await newSession();
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/media`)
      .attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });
});
