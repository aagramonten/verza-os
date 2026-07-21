import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import type { Actor } from '../application/ports.js';
import type { SchedulingService } from '../application/scheduling.service.js';
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  blockCreateSchema,
  idSchema,
  rangeQuerySchema,
  setAvailabilitySchema,
} from './schemas.js';
import { mapError } from './map-error.js';
import '../../auth/middleware/types.js';

export interface SchedulingRouterDeps {
  scheduling: SchedulingService;
  authenticate: RequestHandler;
  requireOwnerOrAdmin: RequestHandler;
}

/** authenticate guarantees req.auth; derive the tenant-scoped actor from it. */
function actorOf(req: Request): Actor {
  return { companyId: req.auth!.companyId, userId: req.auth!.userId };
}

/**
 * Owner agenda controller: availability (weekly windows + one-off blocks),
 * computed free/busy slots, and site-visit appointments. Every route requires
 * authentication AND an OWNER/ADMIN role — the same authorization layer as the
 * other admin modules.
 */
export function createSchedulingRouter(deps: SchedulingRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate, deps.requireOwnerOrAdmin);

  const handle =
    (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next: NextFunction) => {
      fn(req, res).catch((error: unknown) => next(mapError(error)));
    };

  // ── Availability ───────────────────────────────────────────────────

  router.get(
    '/availability',
    handle(async (req, res) => {
      res.status(200).json(await deps.scheduling.getAvailability(actorOf(req)));
    }),
  );

  router.put(
    '/availability',
    handle(async (req, res) => {
      const body = setAvailabilitySchema.parse(req.body);
      res.status(200).json(
        await deps.scheduling.setAvailability(actorOf(req), {
          windows: body.windows,
          ...(body.defaultVisitMinutes !== undefined
            ? { defaultVisitMinutes: body.defaultVisitMinutes }
            : {}),
          ...(body.slotMinutes !== undefined ? { slotMinutes: body.slotMinutes } : {}),
        }),
      );
    }),
  );

  router.get(
    '/availability/slots',
    handle(async (req, res) => {
      const { from, to } = rangeQuerySchema.parse(req.query);
      res.status(200).json(await deps.scheduling.slots(actorOf(req), from, to));
    }),
  );

  router.post(
    '/availability/blocks',
    handle(async (req, res) => {
      const body = blockCreateSchema.parse(req.body);
      res.status(201).json(
        await deps.scheduling.addBlock(actorOf(req), {
          startAt: body.startAt,
          endAt: body.endAt,
          reason: body.reason ?? null,
        }),
      );
    }),
  );

  router.delete(
    '/availability/blocks/:blockId',
    handle(async (req, res) => {
      const blockId = idSchema.parse(req.params['blockId']);
      res.status(200).json(await deps.scheduling.removeBlock(actorOf(req), blockId));
    }),
  );

  // ── Appointments ───────────────────────────────────────────────────

  router.get(
    '/appointments',
    handle(async (req, res) => {
      const { from, to } = rangeQuerySchema.parse(req.query);
      res.status(200).json(await deps.scheduling.listAppointments(actorOf(req), from, to));
    }),
  );

  router.post(
    '/appointments',
    handle(async (req, res) => {
      const body = appointmentCreateSchema.parse(req.body);
      const result = await deps.scheduling.createAppointment(actorOf(req), {
        leadId: body.leadId,
        scheduledAt: body.scheduledAt,
        ...(body.durationMin !== undefined ? { durationMin: body.durationMin } : {}),
        ...(body.locationText !== undefined ? { locationText: body.locationText } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
      res.status(201).json(result);
    }),
  );

  router.patch(
    '/appointments/:appointmentId',
    handle(async (req, res) => {
      const appointmentId = idSchema.parse(req.params['appointmentId']);
      const body = appointmentUpdateSchema.parse(req.body);
      res.status(200).json(
        await deps.scheduling.updateAppointment(actorOf(req), appointmentId, {
          ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt } : {}),
          ...(body.durationMin !== undefined ? { durationMin: body.durationMin } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.locationText !== undefined ? { locationText: body.locationText } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        }),
      );
    }),
  );

  return router;
}
