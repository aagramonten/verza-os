import type { RequestHandler, Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../../shared/audit/audit-log.service.js';
import type { Env } from '../../config/env.js';
import { AuthService } from './application/auth.service.js';
import type { AccessTokenIssuer, Clock, PasswordHasher } from './application/ports.js';
import { JwtAccessTokenIssuer } from './infrastructure/jwt-access-token-issuer.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import { Sha256RefreshTokenCodec } from './infrastructure/sha256-refresh-token-codec.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository.js';
import { InMemoryLoginRateLimiter } from './infrastructure/in-memory-login-rate-limiter.js';
import { createAuthenticate } from './middleware/authenticate.js';
import { createAuthRouter } from './presentation/auth.router.js';

export { requireRole } from './middleware/require-role.js';
export type { AuthContext } from './application/ports.js';

export interface AuthModuleOverrides {
  clock?: Clock;
  hasher?: PasswordHasher;
  issuer?: AccessTokenIssuer;
}

export interface AuthModule {
  router: Router;
  /** Guard that verifies the access token and populates req.auth. */
  authenticate: RequestHandler;
}

/**
 * Composition root for authentication. Also exports `authenticate` so every
 * later module (projects, costs, analytics) reuses the SAME auth layer rather
 * than duplicating token logic (AGENTS.md §Scope Discipline / user directive).
 */
export function createAuthModule(
  env: Env,
  prisma: PrismaClient,
  overrides: AuthModuleOverrides = {},
): AuthModule {
  const clock = overrides.clock ?? new SystemClock();
  const issuer =
    overrides.issuer ?? new JwtAccessTokenIssuer(env.AUTH_JWT_SECRET, env.AUTH_ACCESS_TTL_MIN, clock);
  const hasher = overrides.hasher ?? new ScryptPasswordHasher();

  const service = new AuthService({
    users: new PrismaUserRepository(prisma),
    refreshTokens: new PrismaRefreshTokenRepository(prisma),
    hasher,
    issuer,
    refreshCodec: new Sha256RefreshTokenCodec(),
    clock,
    audit: new AuditLogService(prisma, env.DEFAULT_COMPANY_ID),
    refreshTtlDays: env.AUTH_REFRESH_TTL_DAYS,
  });

  const authenticate = createAuthenticate(issuer);
  const router = createAuthRouter({
    service,
    authenticate,
    loginRateLimiter: new InMemoryLoginRateLimiter(env.AUTH_LOGIN_RATE_LIMIT_PER_MIN, clock),
  });

  return { router, authenticate };
}
