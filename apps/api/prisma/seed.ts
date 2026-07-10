import { PrismaClient, PricingUnit, ServiceType, UserRole } from '@prisma/client';
import { SCORING_CONFIG_V1 } from '@verza/shared';
import { loadEnv } from '../src/config/env.js';

/**
 * Idempotent seed: safe to run repeatedly (upserts keyed on stable uniques).
 * Seeds — per Day 1 spec:
 *   1. Verza Garden company (id fixed by DEFAULT_COMPANY_ID)
 *   2. Owner user
 *   3. Scoring configuration v1 (weights from @verza/shared, strategy §6)
 *   4. Pricing rules v1
 *
 * PLACEHOLDER PRICING: the rates below are placeholders from the approved
 * plan (§11). They MUST be replaced with the owner's real numbers before
 * production cutover (plan Day 10 / DoD).
 */
interface PricingSeed {
  serviceType: ServiceType;
  unit: PricingUnit;
  minRateCents: number;
  maxRateCents: number;
  minimumJobCents: number;
}

const PRICING_RULES_V1: PricingSeed[] = [
  {
    serviceType: ServiceType.LAWN,
    unit: PricingUnit.SQFT,
    minRateCents: 150,
    maxRateCents: 350,
    minimumJobCents: 50_000,
  },
  {
    serviceType: ServiceType.CLEANUP,
    unit: PricingUnit.FLAT,
    minRateCents: 30_000,
    maxRateCents: 80_000,
    minimumJobCents: 30_000,
  },
  {
    serviceType: ServiceType.IRRIGATION,
    unit: PricingUnit.PER_ZONE,
    minRateCents: 40_000,
    maxRateCents: 75_000,
    minimumJobCents: 40_000,
  },
  {
    serviceType: ServiceType.LIGHTING,
    unit: PricingUnit.FLAT,
    minRateCents: 60_000,
    maxRateCents: 150_000,
    minimumJobCents: 60_000,
  },
  {
    serviceType: ServiceType.DESIGN_INSTALLATION,
    unit: PricingUnit.FLAT,
    minRateCents: 80_000,
    maxRateCents: 500_000,
    minimumJobCents: 80_000,
  },
  {
    serviceType: ServiceType.PLANTING,
    unit: PricingUnit.FLAT,
    minRateCents: 20_000,
    maxRateCents: 100_000,
    minimumJobCents: 20_000,
  },
  {
    serviceType: ServiceType.MAINTENANCE,
    unit: PricingUnit.FLAT,
    minRateCents: 15_000,
    maxRateCents: 40_000,
    minimumJobCents: 15_000,
  },
];

export async function seed(prisma: PrismaClient): Promise<void> {
  const env = loadEnv();

  // 1. Company
  const company = await prisma.company.upsert({
    where: { slug: env.DEFAULT_COMPANY_SLUG },
    update: { name: 'Verza Garden' },
    create: {
      id: env.DEFAULT_COMPANY_ID,
      name: 'Verza Garden',
      slug: env.DEFAULT_COMPANY_SLUG,
      settings: {
        municipality: 'Puerto Rico',
        whatsapp: '+19392360534',
        instagram: 'verzagardenpr',
      },
    },
  });

  // 2. Owner user (no password yet — auth ships with the admin console, not the chat MVP)
  await prisma.user.upsert({
    where: { email: env.SEED_OWNER_EMAIL },
    update: { name: env.SEED_OWNER_NAME, role: UserRole.OWNER },
    create: {
      companyId: company.id,
      email: env.SEED_OWNER_EMAIL,
      name: env.SEED_OWNER_NAME,
      role: UserRole.OWNER,
    },
  });

  // 3. Scoring config v1 (deterministic engines read this — strategy §6)
  await prisma.scoringConfig.upsert({
    where: {
      companyId_version: { companyId: company.id, version: SCORING_CONFIG_V1.version },
    },
    update: { config: JSON.parse(JSON.stringify(SCORING_CONFIG_V1)), active: true },
    create: {
      companyId: company.id,
      version: SCORING_CONFIG_V1.version,
      active: true,
      config: JSON.parse(JSON.stringify(SCORING_CONFIG_V1)),
    },
  });

  // 4. Pricing rules v1 — PLACEHOLDER values, replace with owner's real rates.
  for (const rule of PRICING_RULES_V1) {
    await prisma.pricingRule.upsert({
      where: {
        companyId_serviceType_version: {
          companyId: company.id,
          serviceType: rule.serviceType,
          version: 1,
        },
      },
      update: {
        unit: rule.unit,
        minRateCents: rule.minRateCents,
        maxRateCents: rule.maxRateCents,
        minimumJobCents: rule.minimumJobCents,
        active: true,
      },
      create: {
        companyId: company.id,
        serviceType: rule.serviceType,
        unit: rule.unit,
        minRateCents: rule.minRateCents,
        maxRateCents: rule.maxRateCents,
        minimumJobCents: rule.minimumJobCents,
        version: 1,
        active: true,
      },
    });
  }
}

// Allow `npm run db:seed` / `prisma db seed` execution.
const isDirectRun = process.argv[1]?.endsWith('seed.ts') === true;
if (isDirectRun) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(async () => {
      console.log('Seed complete: company, owner, scoring config v1, pricing rules v1.');
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error('Seed failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
