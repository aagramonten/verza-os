import { z } from 'zod';

/**
 * Environment contract. The process refuses to boot when any variable is
 * missing or invalid — misconfiguration must fail fast, never at request time.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    APP_URL: z.string().url(),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(z.array(z.string().url()).min(1)),
    DATABASE_URL: z.string().min(1).startsWith('mysql://', 'DATABASE_URL must be a MySQL URL'),
    DEFAULT_COMPANY_ID: z.string().uuid(),
    DEFAULT_COMPANY_SLUG: z.string().min(1),
    SEED_OWNER_EMAIL: z.string().email(),
    SEED_OWNER_NAME: z.string().min(1),
    // Optional: when set, the seed gives the owner a login password. Empty
    // means "no password" (the chat MVP shipped without owner login).
    SEED_OWNER_PASSWORD: z.string().default(''),
    STORAGE_DRIVER: z.enum(['local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().min(1).default('./uploads'),
    AI_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    AI_PROVIDER_BASE_URL: z.string().url().or(z.literal('')).default(''),
    AI_PROVIDER_API_KEY: z.string().default(''),
    AI_MODEL: z.string().default(''),
    RATE_LIMIT_PUBLIC_RPM: z.coerce.number().int().positive().default(30),
    RESUME_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    // Admin/owner console authentication. The secret signs stateless HS256
    // access tokens; it must be long and random. Refresh tokens are opaque and
    // stored hashed, so only this secret needs protecting for access tokens.
    AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET must be at least 32 characters'),
    AUTH_ACCESS_TTL_MIN: z.coerce.number().int().positive().max(1440).default(15),
    AUTH_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
    AUTH_LOGIN_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  })
  .superRefine((env, ctx) => {
    if (env.AI_ENABLED) {
      if (env.AI_PROVIDER_BASE_URL === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AI_PROVIDER_BASE_URL'],
          message: 'Required when AI_ENABLED=true',
        });
      }
      if (env.AI_PROVIDER_API_KEY === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AI_PROVIDER_API_KEY'],
          message: 'Required when AI_ENABLED=true',
        });
      }
      if (env.AI_MODEL === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AI_MODEL'],
          message: 'Required when AI_ENABLED=true',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/** Parse and validate an environment map. Throws EnvValidationError on failure. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }
  return result.data;
}
