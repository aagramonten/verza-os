import type { Env } from '../../src/config/env.js';
import { loadEnv } from '../../src/config/env.js';

export const TEST_COMPANY_ID = 'c0a80121-7ac0-4e1c-9b25-000000000001';

/** A complete, valid environment map for tests; override per test as needed. */
export function validEnvSource(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    PORT: '3333',
    APP_URL: 'http://localhost:3333',
    CORS_ORIGINS: 'http://localhost:4200',
    DATABASE_URL: process.env['DATABASE_URL'] ?? 'mysql://verza:verza_dev@localhost:3307/verza_os',
    DEFAULT_COMPANY_ID: TEST_COMPANY_ID,
    DEFAULT_COMPANY_SLUG: 'verza-garden',
    SEED_OWNER_EMAIL: 'owner@verzagarden.com',
    SEED_OWNER_NAME: 'Angel Agramonte',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: './uploads',
    AI_ENABLED: 'false',
    RATE_LIMIT_PUBLIC_RPM: '30',
    AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret-0123456789',
    AUTH_ACCESS_TTL_MIN: '15',
    AUTH_REFRESH_TTL_DAYS: '30',
    AUTH_LOGIN_RATE_LIMIT_PER_MIN: '1000',
    ...overrides,
  };
}

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv(validEnvSource(overrides));
}
