import { z } from 'zod';
import { MAX_CHAT_MESSAGE_LENGTH } from '../../../shared/text/sanitize.js';

export const sessionIdSchema = z.string().uuid();

export const sendMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'message must not be empty')
    // Generous pre-sanitization ceiling; the sanitizer enforces the real cap.
    .max(MAX_CHAT_MESSAGE_LENGTH * 2, 'message is too long'),
});

export const resumeSchema = z.object({
  resumeToken: z.string().min(20).max(200),
});

/** Raw resume tokens are base64url; anything else is rejected before hashing. */
export const resumeTokenHeaderSchema = z
  .string()
  .min(20)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'malformed token');
