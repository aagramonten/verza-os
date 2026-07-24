import type { RequestHandler, Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../../shared/audit/audit-log.service.js';
import type { Env } from '../../config/env.js';
import { requireRole } from '../auth/index.js';
import { ProjectService } from './application/project.service.js';
import { CostService } from './application/cost.service.js';
import { MarketingService } from './application/marketing.service.js';
import { PaymentService } from './application/payment.service.js';
import { DashboardService } from './application/dashboard.service.js';
import { QuoteService } from './application/quote.service.js';
import { PrismaProjectRepository } from './infrastructure/prisma-project.repository.js';
import { PrismaCostRepository } from './infrastructure/prisma-cost.repository.js';
import { PrismaMarketingSpendRepository } from './infrastructure/prisma-marketing.repository.js';
import { PrismaPaymentRepository } from './infrastructure/prisma-payment.repository.js';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository.js';
import { PrismaOfficialQuoteRepository } from './infrastructure/prisma-official-quote.repository.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { createFinancialsRouter } from './presentation/financials.router.js';

export interface FinancialsModuleDeps {
  /** Access-token guard from the auth module; reused, never re-implemented. */
  authenticate: RequestHandler;
}

/**
 * Composition root for the financials module (projects, costs, marketing,
 * payments). Reuses the auth module's `authenticate` guard and RBAC so there
 * is a single authorization layer across the product.
 */
export function createFinancialsModule(
  env: Env,
  prisma: PrismaClient,
  deps: FinancialsModuleDeps,
): { router: Router } {
  const audit = new AuditLogService(prisma, env.DEFAULT_COMPANY_ID);
  const projectRepo = new PrismaProjectRepository(prisma);
  const clock = new SystemClock();

  const projects = new ProjectService({ projects: projectRepo, audit });
  const costs = new CostService({
    costs: new PrismaCostRepository(prisma),
    projects: projectRepo,
    audit,
  });
  const payments = new PaymentService({
    payments: new PrismaPaymentRepository(prisma),
    projects: projectRepo,
    audit,
  });
  const marketing = new MarketingService({
    marketing: new PrismaMarketingSpendRepository(prisma),
    projects: projectRepo,
    audit,
  });
  const dashboard = new DashboardService({
    dashboard: new PrismaDashboardRepository(prisma),
    clock,
  });
  const quotes = new QuoteService({
    quotes: new PrismaOfficialQuoteRepository(prisma),
    clock,
  });

  const router = createFinancialsRouter({
    projects,
    costs,
    payments,
    marketing,
    dashboard,
    quotes,
    authenticate: deps.authenticate,
    requireOwnerOrAdmin: requireRole('OWNER', 'ADMIN'),
  });

  return { router };
}
