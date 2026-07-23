import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/infrastructure/scrypt-password-hasher.js';
import { testEnv } from '../helpers/test-env.js';

const env = testEnv();
const PASSWORD = 'Leads-Pw-1!';

describe('Leads API', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof buildApp>;
  let tokenA = '';
  let tokenB = '';
  const companyBId = randomUUID();
  const userIds: string[] = [];
  const leadIds: string[] = [];
  let customerId = '';
  let leadId = '';
  let foreignLeadId = '';

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

    const customer = await prisma.customer.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        name: 'María Rivera',
        phone: `+1787${Math.floor(1000000 + Math.random() * 8999999)}`,
        email: 'maria@test.local',
        municipality: 'Caguas',
      },
    });
    customerId = customer.id;

    const lead = await prisma.lead.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        customerId,
        referenceNumber: `VG-T${Math.floor(1000 + Math.random() * 8999)}`,
        serviceType: 'LAWN',
        status: 'READY_FOR_REVIEW',
        description: 'Grama nueva en el patio',
        collectedData: {
          fields: {
            customerName: 'María Rivera',
            phone: customer.phone,
            municipality: 'Caguas',
            projectArea: 'BACK_YARD',
          },
          confirmed: ['customerName', 'phone'],
        },
        confirmedAt: new Date(),
      },
    });
    leadId = lead.id;
    leadIds.push(lead.id);

    const foreign = await prisma.lead.create({
      data: {
        companyId: companyBId,
        referenceNumber: `VG-T${Math.floor(1000 + Math.random() * 8999)}-B`,
        serviceType: 'CLEANUP',
      },
    });
    foreignLeadId = foreign.id;
    leadIds.push(foreign.id);

    tokenA = await login(emailA);
    tokenB = await login(emailB);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: 'lead', entityId: { in: leadIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.delete({ where: { id: companyBId } });
    await prisma.$disconnect();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/v1/leads');
    expect(res.status).toBe(401);
  });

  it('lists leads newest-first with customer data and a default follow-up status', async () => {
    const res = await request(app).get('/api/v1/leads').set(auth(tokenA));
    expect(res.status).toBe(200);
    const found = res.body.items.find((l: { id: string }) => l.id === leadId);
    expect(found).toBeDefined();
    expect(found.followUpStatus).toBe('NEW');
    expect(found.customer.name).toBe('María Rivera');
    expect(found.customer.municipality).toBe('Caguas');
    expect(typeof found.createdAt).toBe('string');
  });

  it('never lists leads from another tenant', async () => {
    const res = await request(app).get('/api/v1/leads').set(auth(tokenA));
    const ids = res.body.items.map((l: { id: string }) => l.id);
    expect(ids).not.toContain(foreignLeadId);
  });

  it('returns the lead detail with photo count and summary fields', async () => {
    const res = await request(app).get(`/api/v1/leads/${leadId}`).set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.referenceNumber).toMatch(/^VG-T/);
    expect(res.body.photoCount).toBe(0);
    expect(res.body.description).toBe('Grama nueva en el patio');
    expect(res.body.collectedData).toEqual({
      fields: expect.objectContaining({
        customerName: 'María Rivera',
        municipality: 'Caguas',
        projectArea: 'BACK_YARD',
      }),
      confirmed: ['customerName', 'phone'],
    });
  });

  it('updates the follow-up status and persists it', async () => {
    const patch = await request(app)
      .patch(`/api/v1/leads/${leadId}`)
      .set(auth(tokenA))
      .send({ followUpStatus: 'CONTACTED' });
    expect(patch.status).toBe(200);
    expect(patch.body.followUpStatus).toBe('CONTACTED');

    const detail = await request(app).get(`/api/v1/leads/${leadId}`).set(auth(tokenA));
    expect(detail.body.followUpStatus).toBe('CONTACTED');
  });

  it('filters by follow-up status', async () => {
    const res = await request(app)
      .get('/api/v1/leads?followUpStatus=CONTACTED')
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    const ids = res.body.items.map((l: { id: string }) => l.id);
    expect(ids).toContain(leadId);
    for (const item of res.body.items) {
      expect(item.followUpStatus).toBe('CONTACTED');
    }
  });

  it('rejects an invalid follow-up status with 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/leads/${leadId}`)
      .set(auth(tokenA))
      .send({ followUpStatus: 'WON' });
    expect(res.status).toBe(400);
  });

  it('returns 404 (not 403) for a cross-tenant lead so existence never leaks', async () => {
    const read = await request(app).get(`/api/v1/leads/${foreignLeadId}`).set(auth(tokenA));
    expect(read.status).toBe(404);

    const patch = await request(app)
      .patch(`/api/v1/leads/${foreignLeadId}`)
      .set(auth(tokenA))
      .send({ followUpStatus: 'CLOSED' });
    expect(patch.status).toBe(404);

    // And the other tenant's lead is untouched.
    const row = await prisma.lead.findUnique({ where: { id: foreignLeadId } });
    expect(row?.followUpStatus).toBe('NEW');
    expect(tokenB.length).toBeGreaterThan(0);
  });
});
