import { computeSlots, findConflicts } from '../domain/availability.js';
import { InvalidSchedulingInputError, SchedulingNotFoundError } from './errors.js';
import type {
  Actor,
  AppointmentDto,
  AuditRecorder,
  AvailabilityDto,
  ConflictDto,
  CreateAppointmentInput,
  SchedulingRepository,
  SetAvailabilityInput,
  SlotDto,
  UpdateAppointmentInput,
} from './ports.js';

export interface SchedulingServiceDeps {
  repo: SchedulingRepository;
  audit: AuditRecorder;
}

/** Owner agenda: availability, computed slots, and site-visit appointments.
 *  Tenant scope always comes from the actor (verified token) only. */
export class SchedulingService {
  constructor(private readonly deps: SchedulingServiceDeps) {}

  getAvailability(actor: Actor): Promise<AvailabilityDto> {
    return this.deps.repo.getAvailability(actor.companyId);
  }

  async setAvailability(actor: Actor, input: SetAvailabilityInput): Promise<AvailabilityDto> {
    for (const w of input.windows) {
      if (w.weekday < 0 || w.weekday > 6 || w.startMinute >= w.endMinute) {
        throw new InvalidSchedulingInputError('Invalid availability window');
      }
    }
    const result = await this.deps.repo.setAvailability(actor.companyId, input);
    await this.record(actor, 'scheduling.availability.updated', actor.companyId);
    return result;
  }

  async addBlock(
    actor: Actor,
    input: { startAt: Date; endAt: Date; reason: string | null },
  ): Promise<AvailabilityDto> {
    if (input.startAt >= input.endAt) {
      throw new InvalidSchedulingInputError('Block end must be after start');
    }
    const block = await this.deps.repo.addBlock(actor.companyId, input);
    await this.record(actor, 'scheduling.block.added', block.id);
    return this.deps.repo.getAvailability(actor.companyId);
  }

  async removeBlock(actor: Actor, id: string): Promise<AvailabilityDto> {
    const removed = await this.deps.repo.removeBlock(actor.companyId, id);
    if (!removed) {
      throw new SchedulingNotFoundError('Block');
    }
    await this.record(actor, 'scheduling.block.removed', id);
    return this.deps.repo.getAvailability(actor.companyId);
  }

  listAppointments(actor: Actor, from: Date, to: Date): Promise<AppointmentDto[]> {
    return this.deps.repo.listAppointments(actor.companyId, from, to);
  }

  async slots(actor: Actor, from: Date, to: Date): Promise<SlotDto[]> {
    const data = await this.deps.repo.loadAvailabilityData(actor.companyId, from, to);
    return computeSlots({
      from,
      to,
      windows: data.windows,
      blocks: data.blocks,
      appointments: data.activeAppointments,
      slotMinutes: data.slotMinutes,
      visitMinutes: data.visitMinutes,
    }).map((s) => ({
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      free: s.free,
    }));
  }

  async createAppointment(
    actor: Actor,
    input: CreateAppointmentInput,
  ): Promise<{ appointment: AppointmentDto; conflicts: ConflictDto[] }> {
    const exists = await this.deps.repo.leadExists(actor.companyId, input.leadId);
    if (!exists) {
      throw new SchedulingNotFoundError('Lead');
    }
    const conflicts = await this.conflictsFor(
      actor.companyId,
      input.scheduledAt,
      input.durationMin ?? 60,
    );
    const appointment = await this.deps.repo.createAppointment(actor.companyId, input);
    await this.record(actor, 'scheduling.appointment.created', appointment.id, {
      leadId: input.leadId,
      scheduledAt: appointment.scheduledAt,
      hadConflicts: conflicts.length > 0,
    });
    return { appointment, conflicts };
  }

  async updateAppointment(
    actor: Actor,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<{ appointment: AppointmentDto; conflicts: ConflictDto[] }> {
    const updated = await this.deps.repo.updateAppointment(actor.companyId, id, input);
    if (!updated) {
      throw new SchedulingNotFoundError('Appointment');
    }
    const conflicts =
      input.scheduledAt || input.durationMin
        ? await this.conflictsFor(
            actor.companyId,
            new Date(updated.scheduledAt),
            updated.durationMin,
            id,
          )
        : [];
    await this.record(actor, 'scheduling.appointment.updated', id, { fields: Object.keys(input) });
    return { appointment: updated, conflicts };
  }

  /** Conflicts for a proposed slot; excludes the appointment being moved. */
  private async conflictsFor(
    companyId: string,
    scheduledAt: Date,
    durationMin: number,
    excludeId?: string,
  ): Promise<ConflictDto[]> {
    // Widen the load window so an appointment straddling the edges is seen.
    const from = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    const to = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);
    const data = await this.deps.repo.loadAvailabilityData(companyId, from, to, excludeId);
    return findConflicts({
      scheduledAt,
      durationMin,
      windows: data.windows,
      blocks: data.blocks,
      appointments: data.activeAppointments,
    }).map((c) => ({
      kind: c.kind,
      startAt: c.startAt.toISOString(),
      endAt: c.endAt.toISOString(),
    }));
  }

  private record(
    actor: Actor,
    action: string,
    entityId: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    return this.deps.audit.record({
      actorType: 'ADMIN',
      actorId: actor.userId,
      action,
      entity: 'appointment',
      entityId,
      ...(data ? { data } : {}),
    });
  }
}
