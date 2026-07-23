import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import type { Clock, MagicLinkSender } from '../../src/modules/customer-auth/application/ports.js';
import { testEnv } from '../helpers/test-env.js';

class MutableClock implements Clock {
  current = new Date('2026-07-22T12:00:00.000Z');

  now(): Date {
    return this.current;
  }
}

class CapturingSender implements MagicLinkSender {
  sent: Array<{
    companyId: string;
    customerId: string;
    channel: 'email' | 'phone';
    destination: string;
    token: string;
    expiresAt: Date;
  }> = [];

  send(input: (typeof this.sent)[number]): Promise<void> {
    this.sent.push(input);
    return Promise.resolve();
  }
}

describe('Customer passwordless auth API', () => {
  const env = testEnv({
    CUSTOMER_MAGIC_LINK_TTL_MIN: '15',
    CUSTOMER_SESSION_TTL_DAYS: '30',
    CUSTOMER_AUTH_RATE_LIMIT_PER_MIN: '10',
  });
  const companyBId = randomUUID();
  const customerIds: string[] = [];
  const startedAt = new Date();
  let prisma: PrismaClient;
  let app: Express;
  let clock: MutableClock;
  let sender: CapturingSender;
  let customerId = '';
  const email = `portal+${randomUUID()}@test.local`;
  const foreignOnlyEmail = `foreign-only+${randomUUID()}@test.local`;
  const phone = '+17875550321';

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
    await prisma.company.upsert({
      where: { slug: env.DEFAULT_COMPANY_SLUG },
      update: {},
      create: {
        id: env.DEFAULT_COMPANY_ID,
        name: 'Verza Garden',
        slug: env.DEFAULT_COMPANY_SLUG,
      },
    });
    await prisma.company.create({
      data: { id: companyBId, name: 'Other Landscaper', slug: `other-${companyBId}` },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        name: 'Laura Rivera',
        phone,
        email,
        municipality: 'Caguas',
      },
    });
    const foreignCustomer = await prisma.customer.create({
      data: {
        companyId: companyBId,
        name: 'Foreign Laura',
        phone,
        email: foreignOnlyEmail,
        municipality: 'Ponce',
      },
    });
    customerId = customer.id;
    customerIds.push(customer.id, foreignCustomer.id);
  });

  beforeEach(() => {
    clock = new MutableClock();
    sender = new CapturingSender();
    app = buildApp({
      env,
      prisma,
      customerAuthOverrides: { clock, sender },
    });
  });

  afterAll(async () => {
    await prisma.customerSession.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.customerAuthToken.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: 'customer_auth.' }, createdAt: { gte: startedAt } },
    });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.company.delete({ where: { id: companyBId } });
    await prisma.$disconnect();
  });

  it('returns the same generic response for known and unknown identifiers', async () => {
    const known = await request(app)
      .post('/api/v1/mi-jardin/auth/request')
      .send({ identifier: email });
    const unknown = await request(app)
      .post('/api/v1/mi-jardin/auth/request')
      .send({ identifier: `missing+${randomUUID()}@test.local` });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.customerId).toBe(customerId);
    expect(sender.sent[0]).toMatchObject({
      companyId: env.DEFAULT_COMPANY_ID,
      channel: 'email',
      destination: email,
    });
  });

  it('refuses an ambiguous email instead of authenticating an arbitrary customer', async () => {
    const duplicate = await prisma.customer.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        name: 'Duplicate Email',
        phone: `+1787${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`,
        email,
      },
    });
    customerIds.push(duplicate.id);

    try {
      const response = await request(app)
        .post('/api/v1/mi-jardin/auth/request')
        .send({ identifier: email });

      expect(response.status).toBe(202);
      expect(sender.sent).toHaveLength(0);
    } finally {
      await prisma.customer.delete({ where: { id: duplicate.id } });
      customerIds.splice(customerIds.indexOf(duplicate.id), 1);
    }
  });

  it('stores only hashes, consumes a magic link once, and creates a revocable session', async () => {
    await request(app).post('/api/v1/mi-jardin/auth/request').send({ identifier: phone });
    const rawLoginToken = sender.sent[0]?.token;
    expect(rawLoginToken).toBeDefined();

    const storedLogin = await prisma.customerAuthToken.findFirstOrThrow({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(storedLogin.tokenHash).toBe(sha256(rawLoginToken!));
    expect(JSON.stringify(storedLogin)).not.toContain(rawLoginToken);

    const verified = await request(app)
      .post('/api/v1/mi-jardin/auth/verify')
      .send({ token: rawLoginToken });
    expect(verified.status).toBe(200);
    expect(verified.body.customer).toEqual({
      name: 'Laura Rivera',
      phone,
      email,
      municipality: 'Caguas',
    });
    expect(verified.headers['cache-control']).toBe('no-store');
    const sessionToken = verified.body.sessionToken as string;
    expect(sessionToken).toHaveLength(43);

    const replay = await request(app)
      .post('/api/v1/mi-jardin/auth/verify')
      .send({ token: rawLoginToken });
    expect(replay.status).toBe(401);

    const storedSession = await prisma.customerSession.findFirstOrThrow({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(storedSession.tokenHash).toBe(sha256(sessionToken));
    expect(JSON.stringify(storedSession)).not.toContain(sessionToken);

    const me = await request(app)
      .get('/api/v1/mi-jardin/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(me.status).toBe(200);
    expect(me.headers['cache-control']).toBe('no-store');
    expect(me.body.customer.name).toBe('Laura Rivera');

    const logout = await request(app)
      .post('/api/v1/mi-jardin/auth/logout')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({});
    expect(logout.status).toBe(204);

    const afterLogout = await request(app)
      .get('/api/v1/mi-jardin/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(afterLogout.status).toBe(401);
  });

  it('allows only one concurrent exchange of the same magic link', async () => {
    await request(app).post('/api/v1/mi-jardin/auth/request').send({ identifier: phone });
    const rawLoginToken = sender.sent[0]!.token;

    const responses = await Promise.all([
      request(app).post('/api/v1/mi-jardin/auth/verify').send({ token: rawLoginToken }),
      request(app).post('/api/v1/mi-jardin/auth/verify').send({ token: rawLoginToken }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  });

  it('rejects an expired single-use link', async () => {
    await request(app).post('/api/v1/mi-jardin/auth/request').send({ identifier: email });
    const token = sender.sent[0]!.token;
    clock.current = new Date('2026-07-22T12:16:00.000Z');

    const response = await request(app).post('/api/v1/mi-jardin/auth/verify').send({ token });
    expect(response.status).toBe(401);
  });

  it('rejects an expired customer session', async () => {
    await request(app).post('/api/v1/mi-jardin/auth/request').send({ identifier: phone });
    const verified = await request(app)
      .post('/api/v1/mi-jardin/auth/verify')
      .send({ token: sender.sent[0]!.token });
    const sessionToken = verified.body.sessionToken as string;
    clock.current = new Date('2026-08-21T12:00:00.001Z');

    const response = await request(app)
      .get('/api/v1/mi-jardin/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(response.status).toBe(401);
  });

  it('truncates long user-agent values to the database contract', async () => {
    await request(app).post('/api/v1/mi-jardin/auth/request').send({ identifier: phone });
    const response = await request(app)
      .post('/api/v1/mi-jardin/auth/verify')
      .set('User-Agent', 'x'.repeat(500))
      .send({ token: sender.sent[0]!.token });

    expect(response.status).toBe(200);
    const stored = await prisma.customerSession.findFirstOrThrow({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored.userAgent).toHaveLength(191);
  });

  it('never authenticates a customer that exists only in another tenant', async () => {
    const response = await request(app)
      .post('/api/v1/mi-jardin/auth/request')
      .send({ identifier: foreignOnlyEmail });
    expect(response.status).toBe(202);
    expect(sender.sent).toHaveLength(0);
  });

  it('enforces tenant ownership through the session foreign key', async () => {
    await expect(
      prisma.customerSession.create({
        data: {
          companyId: companyBId,
          customerId,
          tokenHash: sha256(randomUUID()),
          expiresAt: new Date('2026-08-01T00:00:00.000Z'),
          lastUsedAt: new Date('2026-07-22T00:00:00.000Z'),
        },
      }),
    ).rejects.toThrow();
  });

  it('rate limits repeated access requests with problem+json and Retry-After', async () => {
    const limitedEnv = testEnv({ CUSTOMER_AUTH_RATE_LIMIT_PER_MIN: '2' });
    const limitedApp = buildApp({
      env: limitedEnv,
      prisma,
      customerAuthOverrides: { clock, sender },
    });
    await request(limitedApp).post('/api/v1/mi-jardin/auth/request').send({ identifier: email });
    await request(limitedApp).post('/api/v1/mi-jardin/auth/request').send({ identifier: email });
    const blocked = await request(limitedApp)
      .post('/api/v1/mi-jardin/auth/request')
      .send({ identifier: email });

    expect(blocked.status).toBe(429);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('rate limits repeated magic-link verification attempts', async () => {
    const limitedEnv = testEnv({ CUSTOMER_AUTH_RATE_LIMIT_PER_MIN: '2' });
    const limitedApp = buildApp({
      env: limitedEnv,
      prisma,
      customerAuthOverrides: { clock, sender },
    });
    const invalidToken = sha256(randomUUID());

    await request(limitedApp).post('/api/v1/mi-jardin/auth/verify').send({ token: invalidToken });
    await request(limitedApp).post('/api/v1/mi-jardin/auth/verify').send({ token: invalidToken });
    const blocked = await request(limitedApp)
      .post('/api/v1/mi-jardin/auth/verify')
      .send({ token: invalidToken });

    expect(blocked.status).toBe(429);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
  });

  it('audits failed magic-link verification without exposing the token', async () => {
    const invalidToken = sha256(randomUUID());
    const response = await request(app)
      .post('/api/v1/mi-jardin/auth/verify')
      .send({ token: invalidToken });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        companyId: env.DEFAULT_COMPANY_ID,
        action: 'customer_auth.login.failed',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(response.status).toBe(401);
    expect(JSON.stringify(audit)).not.toContain(invalidToken);
  });

  it('records delivery=false when no notification adapter is configured', async () => {
    const appWithoutSender = buildApp({
      env,
      prisma,
      customerAuthOverrides: { clock },
    });

    const response = await request(appWithoutSender)
      .post('/api/v1/mi-jardin/auth/request')
      .send({ identifier: phone });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        companyId: env.DEFAULT_COMPANY_ID,
        action: 'customer_auth.requested',
        entityId: customerId,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(response.status).toBe(202);
    expect(audit.data).toMatchObject({ delivered: false });
  });

  it('rejects malformed requests without disclosing internals', async () => {
    const requestResult = await request(app)
      .post('/api/v1/mi-jardin/auth/request')
      .send({ identifier: '' });
    const verifyResult = await request(app)
      .post('/api/v1/mi-jardin/auth/verify')
      .send({ token: 'short' });

    expect(requestResult.status).toBe(400);
    expect(verifyResult.status).toBe(400);
    expect(JSON.stringify(verifyResult.body)).not.toContain('Zod');
  });
});

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
