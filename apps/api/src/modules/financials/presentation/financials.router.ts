import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import type { Actor } from '../application/ports.js';
import type { ProjectService } from '../application/project.service.js';
import type { CostService } from '../application/cost.service.js';
import type { MarketingService } from '../application/marketing.service.js';
import type { PaymentService } from '../application/payment.service.js';
import type { DashboardService } from '../application/dashboard.service.js';
import type { QuoteService } from '../application/quote.service.js';
import {
  costCreateSchema,
  costUpdateSchema,
  idSchema,
  marketingCreateSchema,
  marketingListQuerySchema,
  marketingUpdateSchema,
  officialQuoteCreateSchema,
  paginationSchema,
  paymentCreateSchema,
  paymentUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  emptyActionSchema,
} from './schemas.js';
import { mapError } from './map-error.js';
import '../../auth/middleware/types.js';

export interface FinancialsRouterDeps {
  projects: ProjectService;
  costs: CostService;
  payments: PaymentService;
  marketing: MarketingService;
  dashboard: DashboardService;
  quotes: QuoteService;
  authenticate: RequestHandler;
  requireOwnerOrAdmin: RequestHandler;
}

/** authenticate guarantees req.auth; derive the tenant-scoped actor from it. */
function actorOf(req: Request): Actor {
  return {
    companyId: req.auth!.companyId,
    userId: req.auth!.userId,
    role: req.auth!.role,
    kind: 'HUMAN',
  };
}

/**
 * Financials controller: projects, costs, marketing spend, payments.
 * Every route requires authentication AND an OWNER/ADMIN role — financial
 * data is never exposed to lesser roles (BUSINESS_RULES §Financials).
 */
export function createFinancialsRouter(deps: FinancialsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate, deps.requireOwnerOrAdmin);

  const handle =
    (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next: NextFunction) => {
      fn(req, res).catch((error: unknown) => next(mapError(error)));
    };

  // ── Owner dashboard ────────────────────────────────────────────────

  router.get(
    '/dashboard/financials',
    handle(async (req, res) => {
      res.status(200).json(await deps.dashboard.get(actorOf(req)));
    }),
  );

  // ── Projects ───────────────────────────────────────────────────────

  router.post(
    '/projects',
    handle(async (req, res) => {
      const body = projectCreateSchema.parse(req.body);
      const project = await deps.projects.create(actorOf(req), body);
      res.status(201).json(project);
    }),
  );

  router.get(
    '/projects',
    handle(async (req, res) => {
      const options = paginationSchema.parse(req.query);
      res.status(200).json(await deps.projects.list(actorOf(req), options));
    }),
  );

  router.get(
    '/projects/:projectId',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      res.status(200).json(await deps.projects.get(actorOf(req), projectId));
    }),
  );

  router.patch(
    '/projects/:projectId',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const body = projectUpdateSchema.parse(req.body);
      res.status(200).json(await deps.projects.update(actorOf(req), projectId, body));
    }),
  );

  // ── Official quotes (nested under a project) ──────────────────────

  router.post(
    '/projects/:projectId/quotes',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const body = officialQuoteCreateSchema.parse(req.body);
      res.status(201).json(await deps.quotes.createDraft(actorOf(req), projectId, body));
    }),
  );

  router.get(
    '/projects/:projectId/quotes',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const options = paginationSchema.parse(req.query);
      res.status(200).json(await deps.quotes.list(actorOf(req), projectId, options));
    }),
  );

  router.get(
    '/projects/:projectId/quotes/:quoteId',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const quoteId = idSchema.parse(req.params['quoteId']);
      res.status(200).json(await deps.quotes.get(actorOf(req), projectId, quoteId));
    }),
  );

  router.post(
    '/projects/:projectId/quotes/:quoteId/submit',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const quoteId = idSchema.parse(req.params['quoteId']);
      emptyActionSchema.parse(req.body === undefined ? {} : req.body);
      res.status(200).json(await deps.quotes.submit(actorOf(req), projectId, quoteId));
    }),
  );

  router.post(
    '/projects/:projectId/quotes/:quoteId/approve',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const quoteId = idSchema.parse(req.params['quoteId']);
      emptyActionSchema.parse(req.body === undefined ? {} : req.body);
      res.status(200).json(await deps.quotes.approve(actorOf(req), projectId, quoteId));
    }),
  );

  router.post(
    '/projects/:projectId/quotes/:quoteId/send',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const quoteId = idSchema.parse(req.params['quoteId']);
      emptyActionSchema.parse(req.body === undefined ? {} : req.body);
      res.status(200).json(await deps.quotes.markSent(actorOf(req), projectId, quoteId));
    }),
  );

  router.post(
    '/projects/:projectId/quotes/:quoteId/requote',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const quoteId = idSchema.parse(req.params['quoteId']);
      const body = officialQuoteCreateSchema.parse(req.body);
      res.status(201).json(await deps.quotes.requote(actorOf(req), projectId, quoteId, body));
    }),
  );

  // ── Costs (nested under a project) ─────────────────────────────────

  router.post(
    '/projects/:projectId/costs',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const body = costCreateSchema.parse(req.body);
      res.status(201).json(await deps.costs.create(actorOf(req), projectId, body));
    }),
  );

  router.get(
    '/projects/:projectId/costs',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const options = paginationSchema.parse(req.query);
      res.status(200).json(await deps.costs.list(actorOf(req), projectId, options));
    }),
  );

  router.patch(
    '/projects/:projectId/costs/:costId',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const costId = idSchema.parse(req.params['costId']);
      const body = costUpdateSchema.parse(req.body);
      res.status(200).json(await deps.costs.update(actorOf(req), projectId, costId, body));
    }),
  );

  router.delete(
    '/projects/:projectId/costs/:costId',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const costId = idSchema.parse(req.params['costId']);
      await deps.costs.remove(actorOf(req), projectId, costId);
      res.status(204).send();
    }),
  );

  // ── Payments (nested under a project) ──────────────────────────────

  router.post(
    '/projects/:projectId/payments',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const body = paymentCreateSchema.parse(req.body);
      res.status(201).json(await deps.payments.create(actorOf(req), projectId, body));
    }),
  );

  router.get(
    '/projects/:projectId/payments',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const options = paginationSchema.parse(req.query);
      res.status(200).json(await deps.payments.list(actorOf(req), projectId, options));
    }),
  );

  router.patch(
    '/projects/:projectId/payments/:paymentId',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const paymentId = idSchema.parse(req.params['paymentId']);
      const body = paymentUpdateSchema.parse(req.body);
      res.status(200).json(await deps.payments.update(actorOf(req), projectId, paymentId, body));
    }),
  );

  router.delete(
    '/projects/:projectId/payments/:paymentId',
    handle(async (req, res) => {
      const projectId = idSchema.parse(req.params['projectId']);
      const paymentId = idSchema.parse(req.params['paymentId']);
      await deps.payments.remove(actorOf(req), projectId, paymentId);
      res.status(204).send();
    }),
  );

  // ── Marketing spend ────────────────────────────────────────────────

  router.post(
    '/marketing-spends',
    handle(async (req, res) => {
      const body = marketingCreateSchema.parse(req.body);
      res.status(201).json(await deps.marketing.create(actorOf(req), body));
    }),
  );

  router.get(
    '/marketing-spends',
    handle(async (req, res) => {
      const query = marketingListQuerySchema.parse(req.query);
      res.status(200).json(
        await deps.marketing.list(actorOf(req), {
          limit: query.limit,
          offset: query.offset,
          ...(query.projectId ? { projectId: query.projectId } : {}),
          ...(query.channel ? { channel: query.channel } : {}),
        }),
      );
    }),
  );

  router.patch(
    '/marketing-spends/:id',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params['id']);
      const body = marketingUpdateSchema.parse(req.body);
      res.status(200).json(await deps.marketing.update(actorOf(req), id, body));
    }),
  );

  router.delete(
    '/marketing-spends/:id',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params['id']);
      await deps.marketing.remove(actorOf(req), id);
      res.status(204).send();
    }),
  );

  return router;
}
