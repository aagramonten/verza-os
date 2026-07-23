import type { RequestHandler, Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env.js';
import { AuditLogService } from '../../shared/audit/audit-log.service.js';
import { CustomerAuthService } from './application/customer-auth.service.js';
import type { Clock, MagicLinkSender } from './application/ports.js';
import { PrismaCustomerAuthRepository } from './infrastructure/prisma-customer-auth.repository.js';
import { PrismaCustomerLoginTokenRepository } from './infrastructure/prisma-customer-login-token.repository.js';
import { PrismaCustomerSessionRepository } from './infrastructure/prisma-customer-session.repository.js';
import { Sha256CustomerTokenCodec } from './infrastructure/sha256-customer-token-codec.js';
import { NoopMagicLinkSender } from './infrastructure/noop-magic-link.sender.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { InMemoryRateLimiter } from './infrastructure/in-memory-rate-limiter.js';
import { HmacCustomerPiiHasher } from './infrastructure/hmac-customer-pii-hasher.js';
import { createAuthenticateCustomer } from './middleware/authenticate-customer.js';
import { createCustomerAuthRouter } from './presentation/customer-auth.router.js';

export type { CustomerAuthContext, MagicLinkSender } from './application/ports.js';

export interface CustomerAuthModuleOverrides {
  clock?: Clock;
  sender?: MagicLinkSender;
}

export interface CustomerAuthModule {
  router: Router;
  authenticateCustomer: RequestHandler;
}

export function createCustomerAuthModule(
  env: Env,
  prisma: PrismaClient,
  overrides: CustomerAuthModuleOverrides = {},
): CustomerAuthModule {
  const clock = overrides.clock ?? new SystemClock();
  const piiHasher = new HmacCustomerPiiHasher(env.AUTH_JWT_SECRET);
  const service = new CustomerAuthService({
    companyId: env.DEFAULT_COMPANY_ID,
    customers: new PrismaCustomerAuthRepository(prisma),
    loginTokens: new PrismaCustomerLoginTokenRepository(prisma),
    sessions: new PrismaCustomerSessionRepository(prisma),
    codec: new Sha256CustomerTokenCodec(),
    piiHasher,
    sender: overrides.sender ?? new NoopMagicLinkSender(),
    audit: new AuditLogService(prisma, env.DEFAULT_COMPANY_ID),
    clock,
    magicLinkTtlMin: env.CUSTOMER_MAGIC_LINK_TTL_MIN,
    sessionTtlDays: env.CUSTOMER_SESSION_TTL_DAYS,
  });
  const authenticateCustomer = createAuthenticateCustomer(service);
  const router = createCustomerAuthRouter({
    service,
    authenticate: authenticateCustomer,
    piiHasher,
    requestLimiter: new InMemoryRateLimiter(env.CUSTOMER_AUTH_RATE_LIMIT_PER_MIN, clock),
    verifyLimiter: new InMemoryRateLimiter(env.CUSTOMER_AUTH_RATE_LIMIT_PER_MIN, clock),
  });
  return { router, authenticateCustomer };
}
