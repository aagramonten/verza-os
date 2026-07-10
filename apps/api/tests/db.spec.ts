import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '../src/shared/prisma.js';
import { TEST_COMPANY_ID, testEnv } from './helpers/test-env.js';

describe('database connection', () => {
  const env = testEnv();
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { email: 'db-spec@test.local' } });
    await prisma.$disconnect();
  });

  it('answers SELECT 1', async () => {
    // MySQL integer literals come back from $queryRaw as BigInt.
    const rows = await prisma.$queryRaw<Array<{ ok: bigint }>>`SELECT 1 AS ok`;
    expect(Number(rows[0]?.ok)).toBe(1);
  });

  it('creates and reads back a tenant-scoped customer', async () => {
    const created = await prisma.customer.create({
      data: {
        companyId: TEST_COMPANY_ID,
        name: 'DB Spec',
        email: 'db-spec@test.local',
        phone: '+17875550000',
      },
    });

    const found = await prisma.customer.findUniqueOrThrow({ where: { id: created.id } });
    expect(found.companyId).toBe(TEST_COMPANY_ID);
    expect(found.source).toBe('CHAT');
  });
});
