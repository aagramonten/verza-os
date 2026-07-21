import { z } from 'zod';
import { AppointmentStatus } from '@prisma/client';

export const idSchema = z.string().uuid();

export const rangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

const windowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

export const setAvailabilitySchema = z.object({
  windows: z.array(windowSchema).max(50),
  defaultVisitMinutes: z.number().int().min(15).max(480).optional(),
  slotMinutes: z.number().int().min(15).max(240).optional(),
});

export const blockCreateSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  reason: z.string().max(200).nullable().optional(),
});

export const appointmentCreateSchema = z.object({
  leadId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  durationMin: z.number().int().min(15).max(480).optional(),
  locationText: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const appointmentUpdateSchema = z
  .object({
    scheduledAt: z.coerce.date().optional(),
    durationMin: z.number().int().min(15).max(480).optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    locationText: z.string().max(300).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
