import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { SCORING_CONFIG_V1, SERVICE_TYPES } from '@verza/shared';
import { createPrismaClient } from '../src/shared/prisma.js';
import { seed } from '../prisma/seed.js';
import { TEST_COMPANY_ID, testEnv, validEnvSource } from './helpers/test-env.js';

describe('seed execution', () => {
  const env = testEnv();
  let prisma: PrismaClient;

  beforeAll(async () => {
    // seed() loads env from process.env — provide the test values.
    Object.assign(process.env, validEnvSource());
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
    await seed(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('is idempotent (running twice does not duplicate)', async () => {
    await seed(prisma);
    expect(await prisma.company.count({ where: { slug: 'verza-garden' } })).toBe(1);
  });

  it('seeds the Verza Garden company with the configured id', async () => {
    const company = await prisma.company.findUniqueOrThrow({ where: { slug: 'verza-garden' } });
    expect(company.id).toBe(TEST_COMPANY_ID);
    expect(company.name).toBe('Verza Garden');
  });

  it('seeds the owner user', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@verzagarden.com' },
    });
    expect(owner.role).toBe('OWNER');
    expect(owner.companyId).toBe(TEST_COMPANY_ID);
  });

  it('seeds scoring config v1 with the approved weights', async () => {
    const config = await prisma.scoringConfig.findUniqueOrThrow({
      where: { companyId_version: { companyId: TEST_COMPANY_ID, version: 1 } },
    });
    expect(config.active).toBe(true);
    expect(config.config).toEqual(JSON.parse(JSON.stringify(SCORING_CONFIG_V1)));
  });

  it('seeds active pricing rules for the 7 priced services', async () => {
    const rules = await prisma.pricingRule.findMany({
      where: { companyId: TEST_COMPANY_ID, version: 1, active: true },
    });
    expect(rules).toHaveLength(7);

    const serviced = rules.map((rule) => rule.serviceType).sort();
    const expected = SERVICE_TYPES.filter((s) => s !== 'OTHER').sort();
    expect(serviced).toEqual(expected);

    for (const rule of rules) {
      expect(rule.minRateCents).toBeGreaterThan(0);
      expect(rule.maxRateCents).toBeGreaterThanOrEqual(rule.minRateCents);
      expect(rule.minimumJobCents).toBeGreaterThan(0);
    }
  });
});
