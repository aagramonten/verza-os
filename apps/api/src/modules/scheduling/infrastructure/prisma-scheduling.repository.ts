import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  AppointmentDto,
  AvailabilityData,
  AvailabilityDto,
  CreateAppointmentInput,
  AvailabilityBlockDto,
  SchedulingRepository,
  SetAvailabilityInput,
  UpdateAppointmentInput,
} from '../application/ports.js';

const leadInclude = {
  lead: {
    select: {
      referenceNumber: true,
      serviceType: true,
      customer: { select: { name: true, phone: true, municipality: true } },
    },
  },
} as const;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof leadInclude }>;

// Statuses that occupy the calendar; cancelled/no-show free the slot.
const ACTIVE_STATUSES = ['PROPOSED', 'CONFIRMED', 'COMPLETED'] as const;

export class PrismaSchedulingRepository implements SchedulingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAvailability(companyId: string): Promise<AvailabilityDto> {
    const [windows, blocks, settings] = await Promise.all([
      this.prisma.availabilityWindow.findMany({
        where: { companyId },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      }),
      this.prisma.availabilityBlock.findMany({
        where: { companyId },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.schedulingSettings.findUnique({ where: { companyId } }),
    ]);
    return {
      windows: windows.map((w) => ({
        weekday: w.weekday,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
      })),
      blocks: blocks.map(toBlockDto),
      settings: {
        defaultVisitMinutes: settings?.defaultVisitMinutes ?? 60,
        slotMinutes: settings?.slotMinutes ?? 30,
      },
    };
  }

  async setAvailability(companyId: string, input: SetAvailabilityInput): Promise<AvailabilityDto> {
    await this.prisma.$transaction([
      this.prisma.availabilityWindow.deleteMany({ where: { companyId } }),
      this.prisma.availabilityWindow.createMany({
        data: input.windows.map((w) => ({
          companyId,
          weekday: w.weekday,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        })),
      }),
      this.prisma.schedulingSettings.upsert({
        where: { companyId },
        create: {
          companyId,
          ...(input.defaultVisitMinutes ? { defaultVisitMinutes: input.defaultVisitMinutes } : {}),
          ...(input.slotMinutes ? { slotMinutes: input.slotMinutes } : {}),
        },
        update: {
          ...(input.defaultVisitMinutes ? { defaultVisitMinutes: input.defaultVisitMinutes } : {}),
          ...(input.slotMinutes ? { slotMinutes: input.slotMinutes } : {}),
        },
      }),
    ]);
    return this.getAvailability(companyId);
  }

  async addBlock(
    companyId: string,
    block: { startAt: Date; endAt: Date; reason: string | null },
  ): Promise<AvailabilityBlockDto> {
    const created = await this.prisma.availabilityBlock.create({
      data: { companyId, startAt: block.startAt, endAt: block.endAt, reason: block.reason },
    });
    return toBlockDto(created);
  }

  async removeBlock(companyId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.availabilityBlock.deleteMany({ where: { id, companyId } });
    return count > 0;
  }

  async loadAvailabilityData(
    companyId: string,
    from: Date,
    to: Date,
    excludeAppointmentId?: string,
  ): Promise<AvailabilityData> {
    const [windows, blocks, appointments, settings] = await Promise.all([
      this.prisma.availabilityWindow.findMany({ where: { companyId } }),
      this.prisma.availabilityBlock.findMany({
        where: { companyId, startAt: { lt: to }, endAt: { gt: from } },
      }),
      this.prisma.appointment.findMany({
        where: {
          companyId,
          status: { in: [...ACTIVE_STATUSES] },
          scheduledAt: { lt: to },
          ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        },
      }),
      this.prisma.schedulingSettings.findUnique({ where: { companyId } }),
    ]);

    return {
      windows: windows.map((w) => ({
        weekday: w.weekday,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
      })),
      blocks: blocks.map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
      activeAppointments: appointments
        .map((a) => ({
          startAt: a.scheduledAt,
          endAt: new Date(a.scheduledAt.getTime() + a.durationMin * 60_000),
        }))
        // scheduledAt<to filters the start; keep only those whose end is after `from`.
        .filter((a) => a.endAt.getTime() > from.getTime()),
      slotMinutes: settings?.slotMinutes ?? 30,
      visitMinutes: settings?.defaultVisitMinutes ?? 60,
    };
  }

  async listAppointments(companyId: string, from: Date, to: Date): Promise<AppointmentDto[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { companyId, scheduledAt: { gte: from, lt: to } },
      include: leadInclude,
      orderBy: { scheduledAt: 'asc' },
    });
    return rows.map(toAppointmentDto);
  }

  async leadExists(companyId: string, leadId: string): Promise<boolean> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId },
      select: { id: true },
    });
    return lead !== null;
  }

  async createAppointment(
    companyId: string,
    input: CreateAppointmentInput,
  ): Promise<AppointmentDto> {
    const row = await this.prisma.appointment.create({
      data: {
        companyId,
        leadId: input.leadId,
        scheduledAt: input.scheduledAt,
        durationMin: input.durationMin ?? 60,
        locationText: input.locationText ?? null,
        notes: input.notes ?? null,
      },
      include: leadInclude,
    });
    return toAppointmentDto(row);
  }

  async updateAppointment(
    companyId: string,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<AppointmentDto | null> {
    const data: Prisma.AppointmentUpdateManyMutationInput = {};
    if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
    if (input.durationMin !== undefined) data.durationMin = input.durationMin;
    if (input.status !== undefined) data.status = input.status;
    if (input.locationText !== undefined) data.locationText = input.locationText;
    if (input.notes !== undefined) data.notes = input.notes;

    const { count } = await this.prisma.appointment.updateMany({ where: { id, companyId }, data });
    if (count === 0) {
      return null;
    }
    const row = await this.prisma.appointment.findFirst({
      where: { id, companyId },
      include: leadInclude,
    });
    return row ? toAppointmentDto(row) : null;
  }
}

function toBlockDto(b: {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
}): AvailabilityBlockDto {
  return {
    id: b.id,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    reason: b.reason,
  };
}

function toAppointmentDto(row: AppointmentRow): AppointmentDto {
  return {
    id: row.id,
    leadId: row.leadId,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMin: row.durationMin,
    status: row.status,
    locationText: row.locationText,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lead: row.lead
      ? {
          referenceNumber: row.lead.referenceNumber,
          customerName: row.lead.customer?.name ?? null,
          customerPhone: row.lead.customer?.phone ?? null,
          municipality: row.lead.customer?.municipality ?? null,
          serviceType: row.lead.serviceType,
        }
      : null,
  };
}
