import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/infrastructure/scrypt-password-hasher.js';
import { testEnv } from '../helpers/test-env.js';

const env = testEnv();
const PASSWORD = 'Correct-Horse-9!';

describe('Auth API', () => {
  let prisma: PrismaClient;
  let realApp: ReturnType<typeof buildApp>;
  const ownerEmail = `owner+${randomUUID()}@test.local`;
  const adminEmail = `admin+${randomUUID()}@test.local`;
  const userIds: string[] = [];

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
    realApp = buildApp({ env, prisma });

    await prisma.company.upsert({
      where: { slug: env.DEFAULT_COMPANY_SLUG },
      update: {},
      create: { id: env.DEFAULT_COMPANY_ID, name: 'Verza Garden', slug: env.DEFAULT_COMPANY_SLUG },
    });

    const passwordHash = await new ScryptPasswordHasher().hash(PASSWORD);
    for (const [email, role] of [
      [ownerEmail, 'OWNER'],
      [adminEmail, 'ADMIN'],
    ] as const) {
      const user = await prisma.user.create({
        data: { companyId: env.DEFAULT_COMPANY_ID, email, name: role, role, passwordHash },
      });
      userIds.push(user.id);
    }
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('logs in with valid credentials and returns tokens plus a safe user DTO', async () => {
    const res = await request(realApp)
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.expiresInSec).toBe(env.AUTH_ACCESS_TTL_MIN * 60);
    expect(res.body.user).toMatchObject({ email: ownerEmail, role: 'OWNER' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password with a generic 401', async () => {
    const res = await request(realApp)
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic 401', async () => {
    const res = await request(realApp)
      .post('/api/v1/auth/login')
      .send({ email: `nobody+${randomUUID()}@test.local`, password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('Invalid email or password');
  });

  it('rejects a malformed login body with 400', async () => {
    const res = await request(realApp).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('protects /me: 401 without a token, 200 with one', async () => {
    const anon = await request(realApp).get('/api/v1/auth/me');
    expect(anon.status).toBe(401);

    const login = await request(realApp)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: PASSWORD });
    const me = await request(realApp)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: adminEmail, role: 'ADMIN' });
  });

  it('rejects a garbage bearer token on /me with 401', async () => {
    const res = await request(realApp)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token and detects reuse of a rotated token', async () => {
    const login = await request(realApp)
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: PASSWORD });
    const original = login.body.refreshToken as string;

    // First refresh succeeds and returns a new refresh token.
    const first = await request(realApp).post('/api/v1/auth/refresh').send({ refreshToken: original });
    expect(first.status).toBe(200);
    const rotated = first.body.refreshToken as string;
    expect(rotated).not.toEqual(original);

    // Replaying the ORIGINAL (now revoked) token is reuse → 401 and family revoked.
    const replay = await request(realApp)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: original });
    expect(replay.status).toBe(401);

    // Because reuse revoked the whole family, the rotated token is dead too.
    const rotatedRetry = await request(realApp)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated });
    expect(rotatedRetry.status).toBe(401);
  });

  it('logs out (revokes) a refresh token, and it can no longer refresh', async () => {
    const login = await request(realApp)
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: PASSWORD });
    const token = login.body.refreshToken as string;

    const logout = await request(realApp).post('/api/v1/auth/logout').send({ refreshToken: token });
    expect(logout.status).toBe(204);

    const after = await request(realApp).post('/api/v1/auth/refresh').send({ refreshToken: token });
    expect(after.status).toBe(401);
  });
});
