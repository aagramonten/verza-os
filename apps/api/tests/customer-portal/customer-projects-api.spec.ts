import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { testEnv } from '../helpers/test-env.js';

describe('Customer portal project list API', () => {
  const env = testEnv();
  const suiteId = randomUUID();
  const referencePrefix = `PORTAL-${suiteId}`;
  const companyBId = randomUUID();
  const customerIds: string[] = [];
  let prisma: PrismaClient;
  let app: Express;
  let customerId = '';
  let emptyCustomerId = '';
  let otherCustomerId = '';

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
      data: {
        id: companyBId,
        name: 'Other Landscaper',
        slug: `portal-other-${suiteId}`,
      },
    });

    const [customer, emptyCustomer, otherCustomer] = await Promise.all([
      prisma.customer.create({
        data: {
          companyId: env.DEFAULT_COMPANY_ID,
          name: 'Portal Customer',
          phone: uniquePhone(1),
          email: `portal-${suiteId}@test.local`,
        },
      }),
      prisma.customer.create({
        data: {
          companyId: env.DEFAULT_COMPANY_ID,
          name: 'Empty Portal Customer',
          phone: uniquePhone(2),
          email: `portal-empty-${suiteId}@test.local`,
        },
      }),
      prisma.customer.create({
        data: {
          companyId: env.DEFAULT_COMPANY_ID,
          name: 'Other Portal Customer',
          phone: uniquePhone(3),
          email: `portal-other-customer-${suiteId}@test.local`,
        },
      }),
    ]);

    customerId = customer.id;
    emptyCustomerId = emptyCustomer.id;
    otherCustomerId = otherCustomer.id;
    customerIds.push(customerId, emptyCustomerId, otherCustomerId);
    app = buildApp({ env, prisma });
  });

  beforeEach(async () => {
    await prisma.project.deleteMany({
      where: { referenceNumber: { startsWith: referencePrefix } },
    });
    await prisma.customerSession.deleteMany({
      where: { customerId: { in: customerIds } },
    });
  });

  afterAll(async () => {
    await prisma.officialQuote.deleteMany({
      where: { project: { referenceNumber: { startsWith: referencePrefix } } },
    });
    await prisma.project.deleteMany({
      where: { referenceNumber: { startsWith: referencePrefix } },
    });
    await prisma.customerSession.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customerAuthToken.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.company.delete({ where: { id: companyBId } });
    await prisma.$disconnect();
  });

  it('lists only the safe customer-facing project summary', async () => {
    const older = await prisma.project.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        customerId,
        referenceNumber: `${referencePrefix}-SAFE-1`,
        title: 'Patio tropical',
        serviceType: 'DESIGN_INSTALLATION',
        status: 'PLANNED',
        scope: 'Private project scope',
        notes: 'Internal crew note',
        contractAmountCents: 1_250_000,
        contractSignedAt: new Date('2026-06-01T12:00:00.000Z'),
        createdAt: new Date('2026-06-01T12:00:00.000Z'),
      },
    });
    const newer = await prisma.project.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        customerId,
        referenceNumber: `${referencePrefix}-SAFE-2`,
        title: 'Sistema de riego',
        serviceType: 'IRRIGATION',
        status: 'IN_PROGRESS',
        scope: 'Another private scope',
        notes: 'Another internal note',
        contractAmountCents: 500_000,
        contractSignedAt: new Date('2026-06-02T12:00:00.000Z'),
        startedAt: new Date('2026-06-03T12:00:00.000Z'),
        createdAt: new Date('2026-06-02T12:00:00.000Z'),
      },
    });
    const sessionToken = await createSession(customerId);

    const response = await request(app)
      .get('/api/v1/mi-jardin/projects')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      items: [
        {
          referenceNumber: newer.referenceNumber,
          title: 'Sistema de riego',
          serviceType: 'IRRIGATION',
          status: 'IN_PROGRESS',
          contractSignedAt: '2026-06-02T12:00:00.000Z',
          startedAt: '2026-06-03T12:00:00.000Z',
          completedAt: null,
        },
        {
          referenceNumber: older.referenceNumber,
          title: 'Patio tropical',
          serviceType: 'DESIGN_INSTALLATION',
          status: 'PLANNED',
          contractSignedAt: '2026-06-01T12:00:00.000Z',
          startedAt: null,
          completedAt: null,
        },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain(older.id);
    expect(JSON.stringify(response.body)).not.toContain('Private project scope');
    expect(JSON.stringify(response.body)).not.toContain('Internal crew note');
    expect(JSON.stringify(response.body)).not.toContain('1250000');
  });

  it('returns the existing list envelope with an empty collection', async () => {
    const sessionToken = await createSession(emptyCustomerId);

    const response = await request(app)
      .get('/api/v1/mi-jardin/projects')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('rejects a request without a customer session', async () => {
    const response = await request(app).get('/api/v1/mi-jardin/projects');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('rejects an invalid customer session', async () => {
    const response = await request(app)
      .get('/api/v1/mi-jardin/projects')
      .set('Authorization', `Bearer ${randomToken()}`);

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('rejects an expired customer session', async () => {
    const sessionToken = await createSession(customerId, new Date(Date.now() - 60_000));

    const response = await request(app)
      .get('/api/v1/mi-jardin/projects')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('requires both company and customer ownership when listing projects', async () => {
    const own = await prisma.project.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        customerId,
        referenceNumber: `${referencePrefix}-OWN`,
        title: 'Visible project',
      },
    });
    await prisma.project.createMany({
      data: [
        {
          companyId: env.DEFAULT_COMPANY_ID,
          customerId: otherCustomerId,
          referenceNumber: `${referencePrefix}-OTHER-CUSTOMER`,
          title: 'Other customer project',
        },
        {
          companyId: companyBId,
          customerId,
          referenceNumber: `${referencePrefix}-OTHER-TENANT`,
          title: 'Other tenant project',
        },
      ],
    });
    const sessionToken = await createSession(customerId);

    const response = await request(app)
      .get('/api/v1/mi-jardin/projects')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].referenceNumber).toBe(own.referenceNumber);
    expect(JSON.stringify(response.body)).not.toContain('Other customer project');
    expect(JSON.stringify(response.body)).not.toContain('Other tenant project');
  });

  async function createSession(
    sessionCustomerId: string,
    expiresAt = new Date(Date.now() + 60 * 60 * 1000),
  ): Promise<string> {
    const raw = randomToken();
    await prisma.customerSession.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        customerId: sessionCustomerId,
        tokenHash: sha256(raw),
        expiresAt,
        lastUsedAt: new Date(),
      },
    });
    return raw;
  }
});

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function uniquePhone(offset: number): string {
  return `+1787${String(Number.parseInt(randomUUID().slice(0, 7), 16) + offset)
    .slice(0, 7)
    .padStart(7, '0')}`;
}
