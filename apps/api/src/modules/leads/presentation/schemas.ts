import { z } from 'zod';
import { FollowUpStatus } from '@prisma/client';

export const idSchema = z.string().uuid();

export const leadListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  followUpStatus: z.nativeEnum(FollowUpStatus).optional(),
});

export const leadUpdateSchema = z.object({
  followUpStatus: z.nativeEnum(FollowUpStatus),
});
