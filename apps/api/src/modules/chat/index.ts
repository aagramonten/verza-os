import type { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../../shared/audit/audit-log.service.js';
import type { Env } from '../../config/env.js';
import { createLlmProvider, StaticKnowledgeService, type LlmProvider } from '../ai/index.js';
import { PublicChatService } from './application/public-chat.service.js';
import { ResumeTokenService } from './application/resume-token.service.js';
import { PlaceholderConversationEngine } from './application/placeholder-engine.js';
import { VeraOrchestrator } from './application/vera-orchestrator.js';
import type { Clock, ConversationEngine, RateLimiter } from './application/ports.js';
import { PrismaChatSessionRepository } from './infrastructure/prisma-chat-session.repository.js';
import { PrismaChatMessageRepository } from './infrastructure/prisma-chat-message.repository.js';
import { PrismaChatLeadRepository } from './infrastructure/prisma-chat-lead.repository.js';
import { PrismaChatLeadDataRepository } from './infrastructure/prisma-chat-lead-data.repository.js';
import { PrismaChatExtractionRepository } from './infrastructure/prisma-chat-extraction.repository.js';
import { InMemoryRateLimiter } from './infrastructure/in-memory-rate-limiter.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { createPublicChatRouter } from './presentation/public-chat.router.js';
import { MediaUploadService } from '../media/application/media-upload.service.js';
import { LocalDiskStorage } from '../media/infrastructure/local-disk-storage.js';
import { PrismaLeadMediaRepository } from '../media/infrastructure/prisma-lead-media.repository.js';

export interface ChatModuleOverrides {
  clock?: Clock;
  rateLimiter?: RateLimiter;
  /** Force a specific engine (tests). Overrides the env-selected engine. */
  engine?: ConversationEngine;
  /** Inject a mock LLM provider (tests) to exercise the Vera orchestrator offline. */
  llm?: LlmProvider;
}

/**
 * Composition root for the chat module. Engine selection:
 *  - an explicit `engine` override wins (tests)
 *  - otherwise, if an LLM provider is configured (AI_ENABLED or an injected
 *    mock), the AI-backed Vera orchestrator is used
 *  - otherwise the deterministic placeholder engine keeps the app runnable
 *    without any AI credentials
 */
export function createChatModule(
  env: Env,
  prisma: PrismaClient,
  overrides: ChatModuleOverrides = {},
): { router: Router } {
  const clock = overrides.clock ?? new SystemClock();
  const rateLimiter =
    overrides.rateLimiter ?? new InMemoryRateLimiter(env.RATE_LIMIT_PUBLIC_RPM, clock);
  const audit = new AuditLogService(prisma, env.DEFAULT_COMPANY_ID);
  const leadData = new PrismaChatLeadDataRepository(prisma, env.DEFAULT_COMPANY_ID);
  const extractions = new PrismaChatExtractionRepository(prisma, env.DEFAULT_COMPANY_ID);

  const llm = overrides.llm ?? createLlmProvider(env);
  const knowledge = new StaticKnowledgeService();
  const engine: ConversationEngine =
    overrides.engine ??
    (llm !== null
      ? new VeraOrchestrator({ llm, leadData, extractions, audit, clock, knowledge })
      : new PlaceholderConversationEngine());

  const media = new MediaUploadService(
    new LocalDiskStorage(env.STORAGE_LOCAL_DIR),
    new PrismaLeadMediaRepository(prisma, env.DEFAULT_COMPANY_ID),
  );

  const service = new PublicChatService({
    sessions: new PrismaChatSessionRepository(prisma, env.DEFAULT_COMPANY_ID),
    messages: new PrismaChatMessageRepository(prisma, env.DEFAULT_COMPANY_ID),
    leads: new PrismaChatLeadRepository(prisma, env.DEFAULT_COMPANY_ID),
    leadData,
    tokens: new ResumeTokenService(),
    engine,
    media,
    audit,
    clock,
    resumeTokenTtlDays: env.RESUME_TOKEN_TTL_DAYS,
  });

  return { router: createPublicChatRouter({ service, rateLimiter, audit }) };
}
