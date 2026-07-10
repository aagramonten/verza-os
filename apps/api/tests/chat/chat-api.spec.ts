import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { ResumeTokenService } from '../../src/modules/chat/application/resume-token.service.js';
import { InMemoryRateLimiter } from '../../src/modules/chat/infrastructure/in-memory-rate-limiter.js';
import type { Clock } from '../../src/modules/chat/application/ports.js';
import { TEST_COMPANY_ID, testEnv } from '../helpers/test-env.js';

/** Mutable clock: expiry tests advance time instead of sleeping. */
class MutableClock implements Clock {
  private current = new Date('2026-07-10T12:00:00.000Z');
  now(): Date {
    return new Date(this.current);
  }
  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * 24 * 60 * 60 * 1000);
  }
}

const OTHER_COMPANY_ID = 'c0a80121-7ac0-4e1c-9b25-000000000002';

describe('public chat API', () => {
  const env = testEnv();
  let prisma: PrismaClient;
  let app: Express;
  let clock: MutableClock;
  const createdSessionIds: string[] = [];
  const createdLeadIds: string[] = [];
  const startedAt = new Date();

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
    clock = new MutableClock();
    // Permissive limiter for functional tests; the 429 test builds its own app.
    app = buildApp({
      env,
      prisma,
      chatOverrides: { clock, rateLimiter: new InMemoryRateLimiter(10_000, clock) },
    });
  });

  afterAll(async () => {
    await prisma.aiExtraction.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
    await prisma.chatMessage.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
    await prisma.leadConfirmation.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
    await prisma.chatSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        companyId: { in: [TEST_COMPANY_ID, OTHER_COMPANY_ID] },
        createdAt: { gte: startedAt },
      },
    });
    await prisma.user.deleteMany({ where: { companyId: OTHER_COMPANY_ID } });
    await prisma.company.deleteMany({ where: { id: OTHER_COMPANY_ID } });
    await prisma.$disconnect();
  });

  async function createSession(): Promise<{
    sessionId: string;
    resumeToken: string;
    leadReference: string;
  }> {
    const res = await request(app).post('/api/v1/public/chat/sessions').send({});
    expect(res.status).toBe(201);
    createdSessionIds.push(res.body.sessionId);
    const row = await prisma.chatSession.findUniqueOrThrow({
      where: { id: res.body.sessionId },
      select: { leadId: true },
    });
    if (row.leadId !== null) {
      createdLeadIds.push(row.leadId);
    }
    return res.body;
  }

  it('creates a session with lead reference, STARTED state and a resume token', async () => {
    const body = await createSession();
    expect(body.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.leadReference).toMatch(/^VG-\d{5}$/);
    expect(body.resumeToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const res = await request(app).post('/api/v1/public/chat/sessions').send({});
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('STARTED');
    expect(new Date(res.body.createdAt).toString()).not.toBe('Invalid Date');
    createdSessionIds.push(res.body.sessionId);
    const row = await prisma.chatSession.findUniqueOrThrow({
      where: { id: res.body.sessionId },
      select: { leadId: true },
    });
    if (row.leadId !== null) createdLeadIds.push(row.leadId);
    // Sequential, unique lead references
    expect(res.body.leadReference).not.toBe(body.leadReference);
  });

  it('stores only the token hash — never the raw token', async () => {
    const { sessionId, resumeToken } = await createSession();
    const row = await prisma.chatSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { resumeTokenHash: true },
    });
    expect(row.resumeTokenHash).not.toBe(resumeToken);
    expect(row.resumeTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(new ResumeTokenService().hash(resumeToken)).toBe(row.resumeTokenHash);
  });

  it('persists customer + placeholder assistant messages and advances state step by step', async () => {
    const { sessionId, resumeToken } = await createSession();

    const first = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: 'Hola, quiero cotizar grama' });
    expect(first.status).toBe(201);
    expect(first.body.state).toBe('COLLECTING_CONTACT');
    expect(first.body.messages).toHaveLength(2);
    expect(first.body.messages[0].role).toBe('CUSTOMER');
    expect(first.body.messages[1].role).toBe('VERA');
    expect(first.body.messages[1].content).toContain('Soy Vera');

    const second = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: 'Me llamo Ana, estoy en Caguas' });
    expect(second.status).toBe(201);
    expect(second.body.state).toBe('COLLECTING_PROJECT');
    expect(second.body.messages[1].content).toContain('Perfecto');

    // Third message: placeholder never skips ahead — state stays put.
    const third = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: 'Es para el patio de mi casa' });
    expect(third.status).toBe(201);
    expect(third.body.state).toBe('COLLECTING_PROJECT');

    // Persistence + strict ascending order
    const session = await request(app)
      .get(`/api/v1/public/chat/sessions/${sessionId}`)
      .set('x-resume-token', resumeToken);
    expect(session.status).toBe(200);
    expect(session.body.messages).toHaveLength(6);
    const times = session.body.messages.map((m: { createdAt: string }) =>
      new Date(m.createdAt).getTime(),
    );
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(session.body.messages.map((m: { role: string }) => m.role)).toEqual([
      'CUSTOMER',
      'VERA',
      'CUSTOMER',
      'VERA',
      'CUSTOMER',
      'VERA',
    ]);
  });

  it('CONFIRMED is unreachable through the message endpoint', async () => {
    const { sessionId, resumeToken } = await createSession();
    for (let i = 0; i < 8; i += 1) {
      const res = await request(app)
        .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
        .set('x-resume-token', resumeToken)
        .send({ message: `mensaje ${i}` });
      expect(res.status).toBe(201);
      expect(res.body.state).not.toBe('CONFIRMED');
      expect(res.body.state).not.toBe('READY_FOR_CONFIRMATION');
    }
  });

  it('sanitizes HTML before persisting', async () => {
    const { sessionId, resumeToken } = await createSession();
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: '<script>alert(1)</script>necesito <b>pavers</b>' });
    expect(res.status).toBe(201);
    expect(res.body.messages[0].content).toBe('necesito pavers');
    const stored = await prisma.chatMessage.findFirst({
      where: { sessionId, role: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored?.content).toBe('necesito pavers');
    expect(stored?.content).not.toContain('<');
  });

  it('rejects oversized and empty-after-sanitization messages', async () => {
    const { sessionId, resumeToken } = await createSession();
    const tooLong = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: 'a'.repeat(2001) });
    expect(tooLong.status).toBe(422);
    expect(tooLong.headers['content-type']).toContain('application/problem+json');

    const emptyHtml = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: '<div>   </div>' });
    expect(emptyHtml.status).toBe(422);
  });

  it('resumes with a valid token and audits the resume', async () => {
    const { sessionId, resumeToken, leadReference } = await createSession();
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/resume`)
      .send({ resumeToken });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.leadReference).toBe(leadReference);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'chat.session.resumed', entityId: sessionId },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects an invalid token (401, opaque message)', async () => {
    const { sessionId } = await createSession();
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/resume`)
      .send({ resumeToken: 'A'.repeat(43) });
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    // Same message for every failure mode — no oracle.
    expect(res.body.detail).toBe('Resume token is not valid for this session');
  });

  it('rejects an expired token (fixed clock, no sleeping)', async () => {
    const { sessionId, resumeToken } = await createSession();
    clock.advanceDays(31); // TTL is 30 days
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/resume`)
      .send({ resumeToken });
    expect(res.status).toBe(401);
    clock.advanceDays(-31);
  });

  it('rejects a revoked token', async () => {
    const { sessionId, resumeToken } = await createSession();
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { resumeTokenRevokedAt: new Date() },
    });
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/resume`)
      .send({ resumeToken });
    expect(res.status).toBe(401);
  });

  it("cannot read or resume another tenant's session", async () => {
    await prisma.company.upsert({
      where: { id: OTHER_COMPANY_ID },
      update: {},
      create: { id: OTHER_COMPANY_ID, name: 'Other Co', slug: 'other-co' },
    });
    const tokens = new ResumeTokenService();
    const { rawToken, tokenHash } = tokens.generate();
    const foreignLead = await prisma.lead.create({
      data: { companyId: OTHER_COMPANY_ID, referenceNumber: 'XX-99999', status: 'DRAFT' },
    });
    createdLeadIds.push(foreignLead.id);
    const foreign = await prisma.chatSession.create({
      data: {
        companyId: OTHER_COMPANY_ID,
        leadId: foreignLead.id,
        resumeTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        ipHash: 'other',
      },
    });
    createdSessionIds.push(foreign.id);

    const resume = await request(app)
      .post(`/api/v1/public/chat/sessions/${foreign.id}/resume`)
      .send({ resumeToken: rawToken });
    expect(resume.status).toBe(404); // tenant-scoped lookup cannot see it

    const get = await request(app)
      .get(`/api/v1/public/chat/sessions/${foreign.id}`)
      .set('x-resume-token', rawToken);
    expect(get.status).toBe(404);
  });

  it('status returns only the allowed fields', async () => {
    const { sessionId, resumeToken, leadReference } = await createSession();
    await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: 'hola' });

    const res = await request(app)
      .get(`/api/v1/public/chat/sessions/${sessionId}/status`)
      .set('x-resume-token', resumeToken);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'leadReference',
      'messageCount',
      'state',
      'updatedAt',
    ]);
    expect(res.body.leadReference).toBe(leadReference);
    expect(res.body.messageCount).toBe(2);
  });

  it('public DTOs never leak internal fields', async () => {
    const { sessionId, resumeToken } = await createSession();
    const res = await request(app)
      .get(`/api/v1/public/chat/sessions/${sessionId}`)
      .set('x-resume-token', resumeToken);
    const serialized = JSON.stringify(res.body);
    for (const forbidden of [
      'companyId',
      'ipHash',
      'userAgent',
      'resumeTokenHash',
      'leadScore',
      'confidenceScore',
      'scoreBreakdown',
      'suggestedNextAction',
      'adminSummary',
      'leadId',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('audit trail exists and contains no raw tokens, contents, or raw IPs', async () => {
    const { sessionId, resumeToken } = await createSession();
    const secretMessage = 'mi numero secreto es 787-000-1111';
    await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .set('x-resume-token', resumeToken)
      .send({ message: secretMessage });

    const entries = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: sessionId },
          { action: { in: ['chat.message.customer_created', 'chat.message.assistant_created'] } },
        ],
        createdAt: { gte: startedAt },
      },
    });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('chat.session.created');
    expect(actions).toContain('chat.state.changed');
    expect(actions).toContain('chat.message.customer_created');
    expect(actions).toContain('chat.message.assistant_created');

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(resumeToken);
    expect(serialized).not.toContain(secretMessage);
    expect(serialized).not.toContain('787-000-1111');
    expect(serialized).not.toContain('127.0.0.1');
    expect(serialized).not.toContain('::1');
  });

  it('rate limits with problem+json and Retry-After', async () => {
    const strictApp = buildApp({
      env,
      prisma,
      chatOverrides: { clock, rateLimiter: new InMemoryRateLimiter(2, clock) },
    });
    const first = await request(strictApp).post('/api/v1/public/chat/sessions').send({});
    expect(first.status).toBe(201);
    createdSessionIds.push(first.body.sessionId);
    const leadRow = await prisma.chatSession.findUniqueOrThrow({
      where: { id: first.body.sessionId },
      select: { leadId: true },
    });
    if (leadRow.leadId !== null) createdLeadIds.push(leadRow.leadId);

    const second = await request(strictApp).post('/api/v1/public/chat/sessions').send({});
    expect(second.status).toBe(201);
    createdSessionIds.push(second.body.sessionId);
    const leadRow2 = await prisma.chatSession.findUniqueOrThrow({
      where: { id: second.body.sessionId },
      select: { leadId: true },
    });
    if (leadRow2.leadId !== null) createdLeadIds.push(leadRow2.leadId);

    const third = await request(strictApp).post('/api/v1/public/chat/sessions').send({});
    expect(third.status).toBe(429);
    expect(third.headers['content-type']).toContain('application/problem+json');
    expect(Number(third.headers['retry-after'])).toBeGreaterThan(0);
    expect(third.body.title).toBe('Too Many Requests');

    const audited = await prisma.auditLog.findFirst({
      where: { action: 'chat.rate_limit.exceeded', createdAt: { gte: startedAt } },
    });
    expect(audited).not.toBeNull();
  });

  it('messages endpoint requires a valid token', async () => {
    const { sessionId } = await createSession();
    const res = await request(app)
      .post(`/api/v1/public/chat/sessions/${sessionId}/messages`)
      .send({ message: 'hola' });
    expect(res.status).toBe(401);
  });
});
