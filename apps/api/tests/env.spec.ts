import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../src/config/env.js';
import { validEnvSource } from './helpers/test-env.js';

describe('environment validation', () => {
  it('accepts a complete, valid environment', () => {
    const env = loadEnv(validEnvSource());
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3333);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:4200']);
    expect(env.AI_ENABLED).toBe(false);
  });

  it('crashes when a required variable is missing', () => {
    const source = validEnvSource();
    delete source['DATABASE_URL'];
    expect(() => loadEnv(source)).toThrow(EnvValidationError);
    expect(() => loadEnv(source)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-MySQL DATABASE_URL', () => {
    expect(() => loadEnv(validEnvSource({ DATABASE_URL: 'postgres://x:y@localhost/db' }))).toThrow(
      /MySQL/,
    );
  });

  it('rejects an invalid DEFAULT_COMPANY_ID (must be uuid)', () => {
    expect(() => loadEnv(validEnvSource({ DEFAULT_COMPANY_ID: 'not-a-uuid' }))).toThrow(
      EnvValidationError,
    );
  });

  it('parses CORS_ORIGINS into a list', () => {
    const env = loadEnv(
      validEnvSource({ CORS_ORIGINS: 'https://verzagarden.com, https://www.verzagarden.com' }),
    );
    expect(env.CORS_ORIGINS).toEqual(['https://verzagarden.com', 'https://www.verzagarden.com']);
  });

  it('requires AI provider settings when AI_ENABLED=true', () => {
    expect(() => loadEnv(validEnvSource({ AI_ENABLED: 'true' }))).toThrow(/AI_PROVIDER_BASE_URL/);
  });

  it('requires Resend settings when customer email delivery is enabled', () => {
    expect(() => loadEnv(validEnvSource({ CUSTOMER_MAGIC_LINK_PROVIDER: 'resend' }))).toThrow(
      /RESEND_API_KEY/,
    );
    expect(() =>
      loadEnv(
        validEnvSource({
          CUSTOMER_MAGIC_LINK_PROVIDER: 'resend',
          RESEND_API_KEY: 're_test',
        }),
      ),
    ).toThrow(/CUSTOMER_EMAIL_FROM/);
  });

  it('accepts complete Resend customer email settings', () => {
    const env = loadEnv(
      validEnvSource({
        CUSTOMER_MAGIC_LINK_PROVIDER: 'resend',
        CUSTOMER_PORTAL_URL: 'https://cotizar.verzagarden.com',
        CUSTOMER_EMAIL_FROM: 'Verza Garden <hola@verzagarden.com>',
        RESEND_API_KEY: 're_test',
      }),
    );
    expect(env.CUSTOMER_MAGIC_LINK_PROVIDER).toBe('resend');
  });

  it('requires a safe HTTPS customer portal URL for Resend in production', () => {
    const resend = {
      NODE_ENV: 'production',
      CUSTOMER_MAGIC_LINK_PROVIDER: 'resend',
      CUSTOMER_EMAIL_FROM: 'Verza Garden <hola@verzagarden.com>',
      RESEND_API_KEY: 're_test',
    };
    expect(() =>
      loadEnv(validEnvSource({ ...resend, CUSTOMER_PORTAL_URL: 'http://verzagarden.com' })),
    ).toThrow(/HTTPS/);
    expect(() =>
      loadEnv(
        validEnvSource({
          ...resend,
          CUSTOMER_PORTAL_URL: 'https://user:secret@verzagarden.com',
        }),
      ),
    ).toThrow(/credentials/);
  });
});
