import { z } from 'zod';

export const requestAccessSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
});

export const verifyAccessSchema = z.object({
  token: z.string().trim().min(32).max(512),
});
