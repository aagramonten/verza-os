import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/infrastructure/scrypt-password-hasher.js';
import { testEnv } from '../helpers/test-env.js';

const env = testEnv();
const PASSWORD = 'Financials-Pw-1!';

describe('Financials API', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof buildApp>;
  let tokenA = '';
  let tokenB = '';
  const companyBId = randomUUID();
  const userIds: string[] = [];
  const projectIds: string[] = [];

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
    app = buildApp({ env, prisma });

    await prisma.company.upsert({
      where: { slug: env.DEFAULT_COMPANY_SLUG },
      update: {},
      create: { id: env.DEFAULT_COMPANY_ID, name: 'Verza Garden', slug: env.DEFAULT_COMPANY_SLUG },
    });
    await prisma.company.create({
      data: { id: companyBId, name: 'Rival Co', slug: `rival-${companyBId}` },
    });

    const passwordHash = await new ScryptPasswordHasher().hash(PASSWORD);
    const emailA = `owner-a+${randomUUID()}@test.local`;
    const emailB = `owner-b+${randomUUID()}@test.local`;
    const a = await prisma.user.create({
      data: { companyId: env.DEFAULT_COMPANY_ID, email: emailA, name: 'A', role: 'OWNER', passwordHash },
    });
    const b = await prisma.user.create({
      data: { companyId: companyBId, email: emailB, name: 'B', role: 'ADMIN', passwordHash },
    });
    userIds.push(a.id, b.id);

    tokenA = await login(emailA);
    tokenB = await login(emailB);
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectCost.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.marketingSpend.deleteMany({
      where: { companyId: { in: [env.DEFAULT_COMPANY_ID, companyBId] } },
    });
    await prisma.officialQuote.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.delete({ where: { id: companyBId } });
    await prisma.$disconnect();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('rejects unauthenticated access to financial routes with 401', async () => {
    const res = await request(app).post('/api/v1/projects').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('creates a project with an auto-generated reference and default status', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set(auth(tokenA))
      .send({ title: 'Backyard redesign', serviceType: 'DESIGN_INSTALLATION' });
    expect(res.status).toBe(201);
    expect(res.body.referenceNumber).toMatch(/^VGP-\d{4}$/);
    expect(res.body.status).toBe('PLANNED');
    expect(res.body.currency).toBe('USD');
    projectIds.push(res.body.id);
  });

  it('validates the request body (missing cost category → 400)', async () => {
    const projectId = projectIds[0];
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/costs`)
      .set(auth(tokenA))
      .send({ description: 'no category', quantity: 1, unitCostCents: 100, purchaseDate: '2026-07-01' });
    expect(res.status).toBe(400);
  });

  it('computes a cost total server-side from quantity × unit price', async () => {
    const projectId = projectIds[0];
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/costs`)
      .set(auth(tokenA))
      .send({
        category: 'MULCH',
        description: '5 bags of mulch',
        vendor: 'Home Depot',
        quantity: 2.5,
        unitCostCents: 200,
        purchaseDate: '2026-07-01',
      });
    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(500);
    expect(res.body.quantity).toBe(2.5);
  });

  it('records a payment and lists it', async () => {
    const projectId = projectIds[0];
    const create = await request(app)
      .post(`/api/v1/projects/${projectId}/payments`)
      .set(auth(tokenA))
      .send({ amountCents: 50000, method: 'ATH_MOVIL', type: 'DEPOSIT', receivedAt: '2026-07-02' });
    expect(create.status).toBe(201);

    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/payments`)
      .set(auth(tokenA));
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].amountCents).toBe(50000);
  });

  it('updates the contract amount on a project', async () => {
    const projectId = projectIds[0];
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set(auth(tokenA))
      .send({ contractAmountCents: 250000, status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.contractAmountCents).toBe(250000);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('creates unallocated marketing spend, and 404s an unknown project allocation', async () => {
    const ok = await request(app)
      .post('/api/v1/marketing-spends')
      .set(auth(tokenA))
      .send({ channel: 'FACEBOOK_ADS', amountCents: 12000, spentAt: '2026-07-01' });
    expect(ok.status).toBe(201);

    const bad = await request(app)
      .post('/api/v1/marketing-spends')
      .set(auth(tokenA))
      .send({ channel: 'GOOGLE_ADS', amountCents: 5000, spentAt: '2026-07-01', projectId: randomUUID() });
    expect(bad.status).toBe(404);
  });

  it('returns a tenant-scoped deterministic financial dashboard', async () => {
    const now = new Date();
    const project = await request(app)
      .post('/api/v1/projects')
      .set(auth(tokenB))
      .send({ title: 'Dashboard project', serviceType: 'DESIGN_INSTALLATION' });
    expect(project.status).toBe(201);
    const projectId = project.body.id as string;
    projectIds.push(projectId);

    await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set(auth(tokenB))
      .send({ contractAmountCents: 300000, contractSignedAt: now.toISOString(), status: 'IN_PROGRESS' })
      .expect(200);
    await request(app)
      .post(`/api/v1/projects/${projectId}/costs`)
      .set(auth(tokenB))
      .send({
        category: 'LABOR',
        description: 'Crew labor',
        quantity: 2,
        unitCostCents: 25000,
        purchaseDate: now.toISOString(),
      })
      .expect(201);
    await request(app)
      .post(`/api/v1/projects/${projectId}/payments`)
      .set(auth(tokenB))
      .send({ amountCents: 125000, method: 'CASH', type: 'DEPOSIT', receivedAt: now.toISOString() })
      .expect(201);
    await request(app)
      .post(`/api/v1/projects/${projectId}/payments`)
      .set(auth(tokenB))
      .send({ amountCents: 25000, method: 'CASH', type: 'REFUND', receivedAt: now.toISOString() })
      .expect(201);
    await request(app)
      .post('/api/v1/marketing-spends')
      .set(auth(tokenB))
      .send({
        channel: 'GOOGLE_ADS',
        amountCents: 30000,
        spentAt: now.toISOString(),
        projectId,
      })
      .expect(201);
    await prisma.officialQuote.create({
      data: {
        companyId: companyBId,
        projectId,
        version: 1,
        status: 'SENT',
        subtotalCents: 300000,
        totalCents: 300000,
        sentAt: now,
      },
    });

    const res = await request(app).get('/api/v1/dashboard/financials').set(auth(tokenB));
    expect(res.status).toBe(200);
    expect(res.body.revenue).toMatchObject({
      quotedCents: 300000,
      contractCents: 300000,
      collectedCents: 100000,
      outstandingCents: 200000,
    });
    expect(res.body.thisMonth).toMatchObject({
      contractSignedCents: 300000,
      collectedCents: 100000,
      costsCents: 80000,
      quotesSent: 1,
    });
    expect(res.body.costs).toMatchObject({
      projectCostsCents: 50000,
      marketingSpendCents: 30000,
      totalCents: 80000,
    });
    expect(res.body.costs.breakdown).toEqual([{ category: 'LABOR', amountCents: 50000 }]);
    expect(res.body.profit).toMatchObject({
      grossCents: 250000,
      netCents: 220000,
      grossMarginPct: 83.3,
      netMarginPct: 73.3,
      averagePerProjectCents: 220000,
      roiPct: 275,
    });
    expect(res.body.averages.ticketCents).toBe(300000);
    expect(res.body.projects.total).toBe(1);
    expect(res.body.projects.withContract).toBe(1);
    expect(res.body.profitByService[0]).toMatchObject({
      serviceType: 'DESIGN_INSTALLATION',
      contractCents: 300000,
      costsCents: 80000,
      profitCents: 220000,
      projectCount: 1,
    });
    expect(res.body.marketing).toMatchObject({
      totalCents: 30000,
      costPerLeadCents: null,
      costPerWonCustomerCents: 30000,
    });
    expect(res.body.hero).toMatchObject({
      quotesSentThisMonth: { value: 1, goal: 24, met: false },
      averageTicketCents: { value: 300000, goalCents: 230000, met: true },
      netProfitPerProjectCents: { value: 220000, goalCents: 130000, met: true },
    });
  });

  it('enforces tenant isolation: another company cannot read the project', async () => {
    const projectId = projectIds[0];
    const res = await request(app).get(`/api/v1/projects/${projectId}`).set(auth(tokenB));
    expect(res.status).toBe(404);
  });

  it('enforces tenant isolation: another company cannot add costs to the project', async () => {
    const projectId = projectIds[0];
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/costs`)
      .set(auth(tokenB))
      .send({ category: 'LABOR', description: 'sneaky', quantity: 1, unitCostCents: 100, purchaseDate: '2026-07-01' });
    expect(res.status).toBe(404);
  });
});
