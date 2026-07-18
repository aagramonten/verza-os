import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import type { Actor } from '../application/ports.js';
import type { LeadsService } from '../application/leads.service.js';
import { idSchema, leadListQuerySchema, leadUpdateSchema } from './schemas.js';
import { mapError } from './map-error.js';
import '../../auth/middleware/types.js';

export interface LeadsRouterDeps {
  leads: LeadsService;
  authenticate: RequestHandler;
  requireOwnerOrAdmin: RequestHandler;
}

/** authenticate guarantees req.auth; derive the tenant-scoped actor from it. */
function actorOf(req: Request): Actor {
  return { companyId: req.auth!.companyId, userId: req.auth!.userId };
}

/**
 * Lead follow-up controller for the admin console. Read-mostly: the chat
 * module owns lead creation; here the team only reviews leads and moves them
 * through the follow-up lifecycle.
 */
export function createLeadsRouter(deps: LeadsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate, deps.requireOwnerOrAdmin);

  const handle =
    (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next: NextFunction) => {
      fn(req, res).catch((error: unknown) => next(mapError(error)));
    };

  router.get(
    '/leads',
    handle(async (req, res) => {
      const query = leadListQuerySchema.parse(req.query);
      res.status(200).json(
        await deps.leads.list(actorOf(req), {
          limit: query.limit,
          offset: query.offset,
          ...(query.followUpStatus ? { followUpStatus: query.followUpStatus } : {}),
        }),
      );
    }),
  );

  router.get(
    '/leads/:leadId',
    handle(async (req, res) => {
      const leadId = idSchema.parse(req.params['leadId']);
      res.status(200).json(await deps.leads.get(actorOf(req), leadId));
    }),
  );

  router.patch(
    '/leads/:leadId',
    handle(async (req, res) => {
      const leadId = idSchema.parse(req.params['leadId']);
      const body = leadUpdateSchema.parse(req.body);
      res
        .status(200)
        .json(await deps.leads.updateFollowUpStatus(actorOf(req), leadId, body.followUpStatus));
    }),
  );

  return router;
}
