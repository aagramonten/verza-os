import type { RequestHandler, Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../../shared/audit/audit-log.service.js';
import type { Env } from '../../config/env.js';
import { requireRole } from '../auth/index.js';
import { LeadsService } from './application/leads.service.js';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository.js';
import { createLeadsRouter } from './presentation/leads.router.js';

export interface LeadsModuleDeps {
  /** Access-token guard from the auth module; reused, never re-implemented. */
  authenticate: RequestHandler;
}

/**
 * Composition root for the leads follow-up module. The chat module creates
 * and fills leads; this module exposes them to the admin console for review
 * and follow-up tracking.
 */
export function createLeadsModule(
  env: Env,
  prisma: PrismaClient,
  deps: LeadsModuleDeps,
): { router: Router } {
  const audit = new AuditLogService(prisma, env.DEFAULT_COMPANY_ID);
  const leads = new LeadsService({ leads: new PrismaLeadRepository(prisma), audit });

  const router = createLeadsRouter({
    leads,
    authenticate: deps.authenticate,
    requireOwnerOrAdmin: requireRole('OWNER', 'ADMIN'),
  });

  return { router };
}
