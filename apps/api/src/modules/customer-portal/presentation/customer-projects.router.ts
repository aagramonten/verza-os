import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import type { CustomerProjectsService } from '../application/customer-projects.service.js';
import '../../customer-auth/middleware/types.js';

export interface CustomerProjectsRouterDeps {
  projects: CustomerProjectsService;
  authenticate: RequestHandler;
}

export function createCustomerProjectsRouter(deps: CustomerProjectsRouterDeps): Router {
  const router = Router();

  router.get(
    '/projects',
    deps.authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(await deps.projects.list(req.customerAuth!));
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
