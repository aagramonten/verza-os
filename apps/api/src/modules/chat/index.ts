import type { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../../shared/audit/audit-log.service.js';
import type { Env } from '../../config/env.js';
import { PublicChatService } from './application/public-chat.service.js';
import { ResumeTokenService } from './application/resume-token.service.js';
import { PlaceholderAssistantService } from './application/placeholder-assistant.service.js';
import type { AssistantResponder, Clock, RateLimiter } from './application/ports.js';
import { PrismaChatSessionRepository } from './infrastructure/prisma-chat-session.repository.js';
import { PrismaChatMessageRepository } from './infrastructure/prisma-chat-message.repository.js';
import { PrismaChatLeadRepository } from './infrastructure/prisma-chat-lead.repository.js';
import { InMemoryRateLimiter } from './infrastructure/in-memory-rate-limiter.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { createPublicChatRouter } from './presentation/public-chat.router.js';

export interface ChatModuleOverrides {
  clock?: Clock;
  rateLimiter?: RateLimiter;
  assistant?: AssistantResponder;
}

/**
 * Composition root for the chat module. Tests may override the clock, rate
 * limiter, or assistant; everything else is wired to real infrastructure.
 */
export function createChatModule(
  env: Env,
  prisma: PrismaClient,
  overrides: ChatModuleOverrides = {},
): { router: Router } {
  const clock = overrides.clock ?? new SystemClock();
  const rateLimiter =
    overrides.rateLimiter ?? new InMemoryRateLimiter(env.RATE_LIMIT_PUBLIC_RPM, clock);
  const assistant = overrides.assistant ?? new PlaceholderAssistantService();
  const audit = new AuditLogService(prisma, env.DEFAULT_COMPANY_ID);

  const service = new PublicChatService({
    sessions: new PrismaChatSessionRepository(prisma, env.DEFAULT_COMPANY_ID),
    messages: new PrismaChatMessageRepository(prisma, env.DEFAULT_COMPANY_ID),
    leads: new PrismaChatLeadRepository(prisma, env.DEFAULT_COMPANY_ID),
    tokens: new ResumeTokenService(),
    assistant,
    audit,
    clock,
    resumeTokenTtlDays: env.RESUME_TOKEN_TTL_DAYS,
  });

  return { router: createPublicChatRouter({ service, rateLimiter, audit }) };
}
