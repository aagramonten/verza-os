import type { RequestHandler, Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { CustomerProjectsService } from './application/customer-projects.service.js';
import { PrismaCustomerProjectRepository } from './infrastructure/prisma-customer-project.repository.js';
import { createCustomerProjectsRouter } from './presentation/customer-projects.router.js';

export interface CustomerPortalModuleDeps {
  authenticate: RequestHandler;
}

export interface CustomerPortalModule {
  router: Router;
}

export function createCustomerPortalModule(
  prisma: PrismaClient,
  deps: CustomerPortalModuleDeps,
): CustomerPortalModule {
  const projects = new CustomerProjectsService(new PrismaCustomerProjectRepository(prisma));
  const router = createCustomerProjectsRouter({
    projects,
    authenticate: deps.authenticate,
  });

  return { router };
}
