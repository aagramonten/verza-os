import type { AppointmentStatus } from '@prisma/client';
import type { Interval, Window } from '../domain/availability.js';

/** Tenant-scoped actor derived from a verified access token. */
export interface Actor {
  companyId: string;
  userId: string;
}

export interface AvailabilityWindowDto {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityBlockDto {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface SchedulingSettingsDto {
  defaultVisitMinutes: number;
  slotMinutes: number;
}

export interface AvailabilityDto {
  windows: AvailabilityWindowDto[];
  blocks: AvailabilityBlockDto[];
  settings: SchedulingSettingsDto;
}

export interface AppointmentDto {
  id: string;
  leadId: string;
  scheduledAt: string;
  durationMin: number;
  status: AppointmentStatus;
  locationText: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    referenceNumber: string;
    customerName: string | null;
    customerPhone: string | null;
    municipality: string | null;
    serviceType: string | null;
  } | null;
}

export interface SlotDto {
  startAt: string;
  endAt: string;
  free: boolean;
}

export interface ConflictDto {
  kind: 'appointment' | 'block' | 'outside-hours';
  startAt: string;
  endAt: string;
}

export interface CreateAppointmentInput {
  leadId: string;
  scheduledAt: Date;
  durationMin?: number;
  locationText?: string | null;
  notes?: string | null;
}

export interface UpdateAppointmentInput {
  scheduledAt?: Date;
  durationMin?: number;
  status?: AppointmentStatus;
  locationText?: string | null;
  notes?: string | null;
}

export interface SetAvailabilityInput {
  windows: AvailabilityWindowDto[];
  defaultVisitMinutes?: number;
  slotMinutes?: number;
}

/** Raw availability inputs used by the domain layer, tenant-scoped. */
export interface AvailabilityData {
  windows: Window[];
  blocks: Interval[];
  activeAppointments: Interval[];
  slotMinutes: number;
  visitMinutes: number;
}

export interface SchedulingRepository {
  getAvailability(companyId: string): Promise<AvailabilityDto>;
  setAvailability(companyId: string, input: SetAvailabilityInput): Promise<AvailabilityDto>;
  addBlock(
    companyId: string,
    block: { startAt: Date; endAt: Date; reason: string | null },
  ): Promise<AvailabilityBlockDto>;
  removeBlock(companyId: string, id: string): Promise<boolean>;

  /** Windows/blocks/active appointments + settings, for slot & conflict math.
   *  `excludeAppointmentId` drops one appointment (the one being moved) so it
   *  does not conflict with itself. */
  loadAvailabilityData(
    companyId: string,
    from: Date,
    to: Date,
    excludeAppointmentId?: string,
  ): Promise<AvailabilityData>;

  listAppointments(companyId: string, from: Date, to: Date): Promise<AppointmentDto[]>;
  leadExists(companyId: string, leadId: string): Promise<boolean>;
  createAppointment(companyId: string, input: CreateAppointmentInput): Promise<AppointmentDto>;
  updateAppointment(
    companyId: string,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<AppointmentDto | null>;
}

export interface AuditRecorder {
  record(entry: {
    actorType: 'ADMIN';
    actorId?: string;
    action: string;
    entity: string;
    entityId: string;
    data?: Record<string, unknown>;
  }): Promise<void>;
}
