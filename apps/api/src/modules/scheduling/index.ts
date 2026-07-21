import type { RequestHandler, Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../../shared/audit/audit-log.service.js';
import type { Env } from '../../config/env.js';
import { requireRole } from '../auth/index.js';
import { SchedulingService } from './application/scheduling.service.js';
import { PrismaSchedulingRepository } from './infrastructure/prisma-scheduling.repository.js';
import { createSchedulingRouter } from './presentation/scheduling.router.js';

export interface SchedulingModuleDeps {
  /** Access-token guard from the auth module; reused, never re-implemented. */
  authenticate: RequestHandler;
}

/**
 * Composition root for the scheduling module (owner agenda, availability,
 * site-visit appointments). Reuses the auth module's guard + RBAC so there is a
 * single authorization layer across the product.
 */
export function createSchedulingModule(
  env: Env,
  prisma: PrismaClient,
  deps: SchedulingModuleDeps,
): { router: Router } {
  const audit = new AuditLogService(prisma, env.DEFAULT_COMPANY_ID);
  const scheduling = new SchedulingService({
    repo: new PrismaSchedulingRepository(prisma),
    audit,
  });

  const router = createSchedulingRouter({
    scheduling,
    authenticate: deps.authenticate,
    requireOwnerOrAdmin: requireRole('OWNER', 'ADMIN'),
  });

  return { router };
}
