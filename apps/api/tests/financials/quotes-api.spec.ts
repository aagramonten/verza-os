import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient, UserRole } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import type { AccessTokenIssuer } from '../../src/modules/auth/application/ports.js';
import { JwtAccessTokenIssuer } from '../../src/modules/auth/infrastructure/jwt-access-token-issuer.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/infrastructure/scrypt-password-hasher.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { testEnv } from '../helpers/test-env.js';

const env = testEnv();
const PASSWORD = 'Quotes-Pw-1!';
const FUTURE_VALID_UNTIL = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
const REQUOTE_VALID_UNTIL = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();

interface QuoteLineItemInput {
  description: string;
  quantityMilli: number;
  unitPriceCents: number;
}

interface QuoteInput {
  lineItems: QuoteLineItemInput[];
  taxRateBps: number;
  validUntil: string;
  notes?: string;
}

interface QuoteResponse {
  id: string;
  projectId: string;
  version: number;
  status: string;
  currency: string;
  lineItems: QuoteLineItemInput[];
  taxRateBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  validUntil: string | null;
  notes: string | null;
  approvedAt: string | null;
  sentAt: string | null;
}

const BASE_INPUT: QuoteInput = {
  lineItems: [
    {
      description: 'Diseño e instalación',
      quantityMilli: 2_500,
      unitPriceCents: 12_000,
    },
    {
      description: 'Preparación del terreno',
      quantityMilli: 1_000,
      unitPriceCents: 5_000,
    },
  ],
  taxRateBps: 1_150,
  validUntil: FUTURE_VALID_UNTIL,
  notes: 'Válida por tiempo limitado.',
};

describe('Official quote admin API', () => {
  let prisma: PrismaClient;
  let app: Express;
  let ownerToken = '';
  let adminToken = '';
  let tenantBToken = '';
  let ownerUserId = '';
  let adminUserId = '';
  let customerSessionToken = '';

  const companyBId = randomUUID();
  const userIds: string[] = [];
  const projectIds: string[] = [];
  const quoteIds: string[] = [];
  const customerIds: string[] = [];

  const auth = (token: string): { Authorization: string } => ({
    Authorization: `Bearer ${token}`,
  });

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
        name: 'Quote Tenant B',
        slug: `quote-tenant-${companyBId}`,
      },
    });

    const passwordHash = await new ScryptPasswordHasher().hash(PASSWORD);
    const [owner, admin, tenantBAdmin] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: env.DEFAULT_COMPANY_ID,
          email: `quote-owner+${randomUUID()}@test.local`,
          name: 'Quote Owner',
          role: 'OWNER',
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          companyId: env.DEFAULT_COMPANY_ID,
          email: `quote-admin+${randomUUID()}@test.local`,
          name: 'Quote Admin',
          role: 'ADMIN',
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: `quote-tenant-b+${randomUUID()}@test.local`,
          name: 'Quote Tenant B Admin',
          role: 'ADMIN',
          passwordHash,
        },
      }),
    ]);
    userIds.push(owner.id, admin.id, tenantBAdmin.id);
    ownerUserId = owner.id;
    adminUserId = admin.id;

    const portalCustomer = await prisma.customer.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        name: 'Portal Token Customer',
        phone: uniquePhone(),
        email: `quote-portal+${randomUUID()}@test.local`,
      },
    });
    customerIds.push(portalCustomer.id);
    customerSessionToken = randomBytes(32).toString('base64url');
    await prisma.customerSession.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        customerId: portalCustomer.id,
        tokenHash: sha256(customerSessionToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        lastUsedAt: new Date(),
      },
    });

    app = buildApp({ env, prisma });
    ownerToken = await login(owner.email);
    adminToken = await login(admin.email);
    tenantBToken = await login(tenantBAdmin.email);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'official_quote', entityId: { in: quoteIds } },
          { actorId: { in: userIds } },
        ],
      },
    });
    await prisma.officialQuote.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.customerSession.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customerAuthToken.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.delete({ where: { id: companyBId } });
    await prisma.$disconnect();
  });

  it('runs the human-reviewed flow and computes every total server-side', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);

    const created = await createDraft(ownerToken, projectId);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      projectId,
      version: 1,
      status: 'DRAFT',
      currency: 'USD',
      lineItems: BASE_INPUT.lineItems,
      subtotalCents: 35_000,
      taxRateBps: 1_150,
      taxCents: 4_025,
      totalCents: 39_025,
      notes: BASE_INPUT.notes,
    });
    const quote = trackQuote(created.body);

    const submitted = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/submit`)
      .set(auth(ownerToken))
      .send({});
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('PENDING_APPROVAL');

    const approved = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/approve`)
      .set(auth(adminToken))
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(typeof approved.body.approvedAt).toBe('string');

    const approvedRow = await prisma.officialQuote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    expect(approvedRow.approvedByUserId).toBe(adminUserId);
    expect(approvedRow.subtotalCents).toBe(35_000);
    expect(approvedRow.taxCents).toBe(4_025);
    expect(approvedRow.totalCents).toBe(39_025);

    const sent = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/send`)
      .set(auth(ownerToken))
      .send({});
    expect(sent.status).toBe(200);
    expect(sent.body.status).toBe('SENT');
    expect(typeof sent.body.sentAt).toBe('string');

    await assertAudit({
      quoteId: quote.id,
      action: 'financials.quote.approved',
      actorId: adminUserId,
      companyId: env.DEFAULT_COMPANY_ID,
      expectedCount: 1,
    });
    await assertAudit({
      quoteId: quote.id,
      action: 'financials.quote.sent',
      actorId: ownerUserId,
      companyId: env.DEFAULT_COMPANY_ID,
      expectedCount: 1,
    });
  });

  it('allows an OWNER to approve and an ADMIN to send', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const created = await createAndSubmit(adminToken, projectId);

    const approved = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${created.id}/approve`)
      .set(auth(ownerToken))
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');

    const sent = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${created.id}/send`)
      .set(auth(adminToken))
      .send({});
    expect(sent.status).toBe(200);
    expect(sent.body.status).toBe('SENT');
  });

  it('returns tenant-scoped safe DTOs and requires requote for later versions', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const created = await createDraft(ownerToken, projectId);
    expect(created.status).toBe(201);
    const quote = trackQuote(created.body);

    const detail = await request(app)
      .get(`/api/v1/projects/${projectId}/quotes/${quote.id}`)
      .set(auth(ownerToken));
    expect(detail.status).toBe(200);
    expect(detail.body.lineItems[0]).toMatchObject({
      quantityMilli: 2_500,
      unitPriceCents: 12_000,
      lineTotalCents: 30_000,
    });
    expect(detail.body).not.toHaveProperty('companyId');
    expect(detail.body).not.toHaveProperty('approvedByUserId');
    expect(Object.keys(detail.body).sort()).toEqual(
      [
        'acceptedAt',
        'approvedAt',
        'createdAt',
        'currency',
        'id',
        'lineItems',
        'notes',
        'projectId',
        'sentAt',
        'status',
        'subtotalCents',
        'taxCents',
        'taxRateBps',
        'totalCents',
        'updatedAt',
        'validUntil',
        'version',
      ].sort(),
    );
    expect(Object.keys(detail.body.lineItems[0]).sort()).toEqual(
      ['description', 'lineTotalCents', 'quantityMilli', 'unitPriceCents'].sort(),
    );

    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/quotes`)
      .set(auth(ownerToken));
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ total: 1, limit: 50, offset: 0 });
    expect(list.body.items[0].id).toBe(quote.id);
    expect(Object.keys(list.body.items[0]).sort()).toEqual(Object.keys(detail.body).sort());

    const duplicateDraft = await createDraft(ownerToken, projectId);
    expectProblem(duplicateDraft, 409, 'Conflict');
  });

  it('creates a new DRAFT version when requoting and supersedes the prior quote', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const original = await createAndSubmit(ownerToken, projectId);
    await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${original.id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(200);
    await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${original.id}/send`)
      .set(auth(adminToken))
      .send({})
      .expect(200);

    const replacementInput: QuoteInput = {
      lineItems: [
        {
          description: 'Alcance revisado',
          quantityMilli: 2_000,
          unitPriceCents: 20_000,
        },
      ],
      taxRateBps: 0,
      validUntil: REQUOTE_VALID_UNTIL,
      notes: 'Segunda versión.',
    };
    const requoted = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${original.id}/requote`)
      .set(auth(ownerToken))
      .send(replacementInput);

    expect(requoted.status).toBe(201);
    expect(requoted.body).toMatchObject({
      projectId,
      version: 2,
      status: 'DRAFT',
      subtotalCents: 40_000,
      taxCents: 0,
      totalCents: 40_000,
    });
    expect(requoted.body.id).not.toBe(original.id);
    trackQuote(requoted.body);

    const prior = await prisma.officialQuote.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(prior.status).toBe('SUPERSEDED');
  });

  it.each([
    {
      name: 'empty line items',
      body: { ...BASE_INPUT, lineItems: [] },
    },
    {
      name: 'zero quantity',
      body: {
        ...BASE_INPUT,
        lineItems: [{ description: 'Invalid', quantityMilli: 0, unitPriceCents: 100 }],
      },
    },
    {
      name: 'fractional quantityMilli',
      body: {
        ...BASE_INPUT,
        lineItems: [{ description: 'Invalid', quantityMilli: 1.5, unitPriceCents: 100 }],
      },
    },
    {
      name: 'negative unit price',
      body: {
        ...BASE_INPUT,
        lineItems: [{ description: 'Invalid', quantityMilli: 1_000, unitPriceCents: -1 }],
      },
    },
    {
      name: 'tax above 100 percent',
      body: { ...BASE_INPUT, taxRateBps: 10_001 },
    },
    {
      name: 'invalid expiration',
      body: { ...BASE_INPUT, validUntil: 'not-a-date' },
    },
    {
      name: 'past expiration',
      body: {
        ...BASE_INPUT,
        validUntil: new Date(Date.now() - 60_000).toISOString(),
      },
    },
    {
      name: 'client-computed total',
      body: { ...BASE_INPUT, totalCents: 1 },
    },
  ])('returns problem+json 400 for a strict invalid draft body: $name', async ({ body }) => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes`)
      .set(auth(ownerToken))
      .send(body);

    expectProblem(response, 400, 'Bad Request');
  });

  it('applies the same strict Zod contract when requoting', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const original = await createAndSubmit(ownerToken, projectId);
    await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${original.id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(200);
    await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${original.id}/send`)
      .set(auth(adminToken))
      .send({})
      .expect(200);

    const invalid = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${original.id}/requote`)
      .set(auth(ownerToken))
      .send({ ...BASE_INPUT, approvedByUserId: ownerUserId });

    expectProblem(invalid, 400, 'Bad Request');
  });

  it('returns 401 for an unauthenticated quote mutation', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes`)
      .send(BASE_INPUT);

    expectProblem(response, 401, 'Unauthorized');
  });

  it('returns 403 when a verified access token has a role outside OWNER/ADMIN', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const forbiddenIssuer: AccessTokenIssuer = {
      issue: () => ({ token: 'unused', expiresInSec: 900 }),
      verify: () => ({
        userId: ownerUserId,
        companyId: env.DEFAULT_COMPANY_ID,
        role: 'WORKER' as UserRole,
      }),
    };
    const forbiddenApp = buildApp({
      env,
      prisma,
      authOverrides: { issuer: forbiddenIssuer },
    });

    const response = await request(forbiddenApp)
      .post(`/api/v1/projects/${projectId}/quotes`)
      .set(auth('verified-but-forbidden'))
      .send(BASE_INPUT);

    expectProblem(response, 403, 'Forbidden');
  });

  it('does not allow a signed AI-role token to approve a quote', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const quote = await createAndSubmit(ownerToken, projectId);
    const issuer = new JwtAccessTokenIssuer(env.AUTH_JWT_SECRET, env.AUTH_ACCESS_TTL_MIN, {
      now: () => new Date(),
    });
    const aiToken = issuer.issue({
      userId: randomUUID(),
      companyId: env.DEFAULT_COMPANY_ID,
      role: 'VERA' as UserRole,
    }).token;

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/approve`)
      .set(auth(aiToken))
      .send({});

    expectProblem(response, 401, 'Unauthorized');
    expect(await quoteStatus(quote.id)).toBe('PENDING_APPROVAL');
    await assertAudit({
      quoteId: quote.id,
      action: 'financials.quote.approved',
      actorId: randomUUID(),
      companyId: env.DEFAULT_COMPANY_ID,
      expectedCount: 0,
    });
  });

  it('does not allow a customer portal session to approve a quote', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const quote = await createAndSubmit(ownerToken, projectId);

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/approve`)
      .set(auth(customerSessionToken))
      .send({});

    expectProblem(response, 401, 'Unauthorized');
    expect(await quoteStatus(quote.id)).toBe('PENDING_APPROVAL');
  });

  it('returns 404 without leaking or mutating a quote from another tenant', async () => {
    const projectAId = await createProject(env.DEFAULT_COMPANY_ID);
    const quoteA = await createAndSubmit(ownerToken, projectAId);

    const approve = await request(app)
      .post(`/api/v1/projects/${projectAId}/quotes/${quoteA.id}/approve`)
      .set(auth(tenantBToken))
      .send({});
    expectProblem(approve, 404, 'Not Found');
    expect(await quoteStatus(quoteA.id)).toBe('PENDING_APPROVAL');

    const create = await request(app)
      .post(`/api/v1/projects/${projectAId}/quotes`)
      .set(auth(tenantBToken))
      .send(BASE_INPUT);
    expectProblem(create, 404, 'Not Found');

    const detail = await request(app)
      .get(`/api/v1/projects/${projectAId}/quotes/${quoteA.id}`)
      .set(auth(tenantBToken));
    expectProblem(detail, 404, 'Not Found');

    const list = await request(app)
      .get(`/api/v1/projects/${projectAId}/quotes`)
      .set(auth(tenantBToken));
    expectProblem(list, 404, 'Not Found');

    const successAudits = await prisma.auditLog.count({
      where: {
        entity: 'official_quote',
        entityId: quoteA.id,
        action: 'financials.quote.approved',
      },
    });
    expect(successAudits).toBe(0);
  });

  it('rejects expired and inconsistent stored snapshots before approval', async () => {
    const expiredProjectId = await createProject(env.DEFAULT_COMPANY_ID);
    const expired = await createAndSubmit(ownerToken, expiredProjectId);
    await prisma.officialQuote.update({
      where: { id: expired.id },
      data: { validUntil: new Date(Date.now() - 60_000) },
    });

    const approveExpired = await request(app)
      .post(`/api/v1/projects/${expiredProjectId}/quotes/${expired.id}/approve`)
      .set(auth(adminToken))
      .send({});
    expectProblem(approveExpired, 409, 'Conflict');
    expect(await quoteStatus(expired.id)).toBe('PENDING_APPROVAL');

    const invalidProjectId = await createProject(env.DEFAULT_COMPANY_ID);
    const invalid = await prisma.officialQuote.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        projectId: invalidProjectId,
        version: 1,
        status: 'DRAFT',
        subtotalCents: 0,
        taxRateBps: null,
        taxCents: 0,
        totalCents: 0,
        validUntil: new Date(Date.now() + 60_000),
      },
    });
    quoteIds.push(invalid.id);

    const submitInvalid = await request(app)
      .post(`/api/v1/projects/${invalidProjectId}/quotes/${invalid.id}/submit`)
      .set(auth(ownerToken))
      .send({});
    expectProblem(submitInvalid, 409, 'Conflict');
    expect(await quoteStatus(invalid.id)).toBe('DRAFT');
  });

  it('strictly rejects null and client-controlled action bodies', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const created = await createDraft(ownerToken, projectId);
    const quote = trackQuote(created.body);

    const nullBody = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/submit`)
      .set(auth(ownerToken))
      .set('Content-Type', 'application/json')
      .send('null');
    expectProblem(nullBody, 400, 'Bad Request');

    const injectedState = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/submit`)
      .set(auth(ownerToken))
      .send({ status: 'APPROVED' });
    expectProblem(injectedState, 400, 'Bad Request');
    expect(await quoteStatus(quote.id)).toBe('DRAFT');
  });

  it('writes quote audit rows into the authenticated tenant, not the default tenant', async () => {
    const projectId = await createProject(companyBId);
    const quote = await createAndSubmit(tenantBToken, projectId);

    await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/approve`)
      .set(auth(tenantBToken))
      .send({})
      .expect(200);
    await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/send`)
      .set(auth(tenantBToken))
      .send({})
      .expect(200);

    const audits = await prisma.auditLog.findMany({
      where: {
        entity: 'official_quote',
        entityId: quote.id,
        action: {
          in: ['financials.quote.approved', 'financials.quote.sent'],
        },
      },
    });
    expect(audits).toHaveLength(2);
    expect(audits.every((entry) => entry.companyId === companyBId)).toBe(true);
  });

  it('returns 409 for invalid lifecycle transitions without success audit rows', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const draftResponse = await createDraft(ownerToken, projectId);
    const draft = trackQuote(draftResponse.body);

    const approveDraft = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${draft.id}/approve`)
      .set(auth(ownerToken))
      .send({});
    expectProblem(approveDraft, 409, 'Conflict');

    await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${draft.id}/submit`)
      .set(auth(ownerToken))
      .send({})
      .expect(200);
    const sendPending = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${draft.id}/send`)
      .set(auth(ownerToken))
      .send({});
    expectProblem(sendPending, 409, 'Conflict');

    const successAudits = await prisma.auditLog.count({
      where: {
        entity: 'official_quote',
        entityId: draft.id,
        action: {
          in: ['financials.quote.approved', 'financials.quote.sent'],
        },
      },
    });
    expect(successAudits).toBe(0);
  });

  it('keeps approve and send idempotent without duplicate audit rows', async () => {
    const projectId = await createProject(env.DEFAULT_COMPANY_ID);
    const quote = await createAndSubmit(ownerToken, projectId);

    const firstApproval = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/approve`)
      .set(auth(adminToken))
      .send({});
    const secondApproval = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/approve`)
      .set(auth(adminToken))
      .send({});
    expect(firstApproval.status).toBe(200);
    expect(secondApproval.status).toBe(200);
    expect(secondApproval.body.approvedAt).toBe(firstApproval.body.approvedAt);

    const firstSend = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/send`)
      .set(auth(ownerToken))
      .send({});
    const secondSend = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/send`)
      .set(auth(ownerToken))
      .send({});
    expect(firstSend.status).toBe(200);
    expect(secondSend.status).toBe(200);
    expect(secondSend.body.sentAt).toBe(firstSend.body.sentAt);

    await assertAudit({
      quoteId: quote.id,
      action: 'financials.quote.approved',
      actorId: adminUserId,
      companyId: env.DEFAULT_COMPANY_ID,
      expectedCount: 1,
    });
    await assertAudit({
      quoteId: quote.id,
      action: 'financials.quote.sent',
      actorId: ownerUserId,
      companyId: env.DEFAULT_COMPANY_ID,
      expectedCount: 1,
    });
  });

  async function login(email: string): Promise<string> {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response.body.accessToken as string;
  }

  async function createProject(companyId: string): Promise<string> {
    const project = await prisma.project.create({
      data: {
        companyId,
        referenceNumber: `VGP-Q-${randomUUID()}`,
        title: 'Quote API project',
        serviceType: 'DESIGN_INSTALLATION',
      },
    });
    projectIds.push(project.id);
    return project.id;
  }

  async function createDraft(
    token: string,
    projectId: string,
    input: QuoteInput = BASE_INPUT,
  ): Promise<request.Response> {
    return request(app).post(`/api/v1/projects/${projectId}/quotes`).set(auth(token)).send(input);
  }

  async function createAndSubmit(token: string, projectId: string): Promise<QuoteResponse> {
    const created = await createDraft(token, projectId);
    expect(created.status).toBe(201);
    const quote = trackQuote(created.body);
    const submitted = await request(app)
      .post(`/api/v1/projects/${projectId}/quotes/${quote.id}/submit`)
      .set(auth(token))
      .send({});
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('PENDING_APPROVAL');
    return submitted.body as QuoteResponse;
  }

  function trackQuote(body: unknown): QuoteResponse {
    const quote = body as QuoteResponse;
    expect(typeof quote.id).toBe('string');
    quoteIds.push(quote.id);
    return quote;
  }

  async function quoteStatus(quoteId: string): Promise<string> {
    const quote = await prisma.officialQuote.findUniqueOrThrow({
      where: { id: quoteId },
      select: { status: true },
    });
    return quote.status;
  }

  async function assertAudit(input: {
    quoteId: string;
    action: string;
    actorId: string;
    companyId: string;
    expectedCount: number;
  }): Promise<void> {
    const entries = await prisma.auditLog.findMany({
      where: {
        entity: 'official_quote',
        entityId: input.quoteId,
        action: input.action,
      },
    });
    expect(entries).toHaveLength(input.expectedCount);
    for (const entry of entries) {
      expect(entry.actorType).toBe('ADMIN');
      expect(entry.actorId).toBe(input.actorId);
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain(ownerToken);
      expect(serialized).not.toContain(adminToken);
      expect(serialized).not.toContain(customerSessionToken);
      expect(serialized).not.toContain(BASE_INPUT.lineItems[0]?.description);
    }
  }
});

function expectProblem(response: request.Response, status: number, title: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain('application/problem+json');
  expect(response.body).toMatchObject({
    type: 'about:blank',
    title,
    status,
  });
  expect(JSON.stringify(response.body)).not.toContain('Zod');
  expect(JSON.stringify(response.body)).not.toContain('Prisma');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function uniquePhone(): string {
  return `+1787${String(Number.parseInt(randomUUID().slice(0, 7), 16))
    .slice(0, 7)
    .padStart(7, '0')}`;
}
