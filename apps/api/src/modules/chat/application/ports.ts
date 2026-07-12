import type { ChatSessionState } from '@verza/shared';
import type { ChatMessage, ChatMessageRole, ChatSession } from '../domain/chat-session.js';
import type { CollectedProjectState } from './collected-project.js';
import type { QuickActionEvent } from './quick-action.js';
import type { ConfirmationSummary } from './summary.js';

/** Injectable time source so expiration tests never sleep. */
export interface Clock {
  now(): Date;
}

/**
 * Rate limiter port. The MVP binds an in-memory implementation (single
 * instance only — documented limitation); a Redis implementation can replace
 * it without touching callers.
 */
export interface RateLimiter {
  hit(key: string): { allowed: boolean; retryAfterSeconds: number };
}

export interface CreateSessionInput {
  leadId: string;
  leadReference: string;
  resumeTokenHash: string;
  expiresAt: Date;
  ipHash: string;
  userAgent: string | null;
}

export interface ChatSessionRepository {
  create(input: CreateSessionInput): Promise<ChatSession>;
  findById(sessionId: string): Promise<ChatSession | null>;
  findTokenHash(sessionId: string): Promise<string | null>;
  updateState(sessionId: string, state: ChatSessionState): Promise<void>;
  touch(sessionId: string, at: Date): Promise<void>;
  revokeToken(sessionId: string, at: Date): Promise<void>;
}

export interface ChatMessageRepository {
  /** Append-only: there is intentionally no update or delete operation. */
  append(sessionId: string, role: ChatMessageRole, content: string): Promise<ChatMessage>;
  listAscending(sessionId: string): Promise<ChatMessage[]>;
  count(sessionId: string): Promise<number>;
}

export interface ChatLeadRepository {
  createDraft(): Promise<{ id: string; referenceNumber: string }>;
}

/** Mirror of collected data onto typed columns + the customer row. */
export interface LeadMirror {
  customer: {
    name?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    municipality?: string | undefined;
    propertyType?: string | undefined;
  };
  serviceType?: string | undefined;
  description?: string | undefined;
  requiresRemoval?: boolean | undefined;
  hasIrrigation?: boolean | undefined;
  budgetMinCents?: number | undefined;
  budgetMaxCents?: number | undefined;
  desiredDate?: string | undefined;
  preferredVisitTime?: string | undefined;
}

export interface ChatLeadDataRepository {
  loadCollected(leadId: string): Promise<CollectedProjectState>;
  saveCollected(leadId: string, state: CollectedProjectState): Promise<void>;
  /** Best-effort mirror to typed columns + customer upsert (never throws the turn). */
  applyMirror(leadId: string, mirror: LeadMirror): Promise<void>;
  countPhotos(leadId: string): Promise<number>;
  /** Marks the lead ready for human review with an immutable summary snapshot. */
  markReadyForReview(leadId: string, summary: ConfirmationSummary, at: Date): Promise<void>;
}

export interface ExtractionRecord {
  sessionId: string;
  messageId: string;
  model: string;
  promptVersion: string;
  rawOutput: unknown;
  validatedOutput: unknown | null;
  valid: boolean;
  errors: unknown | null;
  appliedFields: unknown | null;
  latencyMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface ChatExtractionRepository {
  save(record: ExtractionRecord): Promise<void>;
  /** Number of failed/invalid extractions for a session — used to flag repeated failures. */
  countInvalid(sessionId: string): Promise<number>;
}

/** Context handed to a conversation engine for a single turn. */
export interface ConversationContext {
  session: ChatSession;
  customerMessageId: string;
  latestCustomerMessage: string;
  history: { role: ChatMessageRole; content: string }[];
  photoCount: number;
  quickActionEvent?: QuickActionEvent | null;
}

/** Result of a turn. The engine decides the target phase (server code); the
 *  service walks the state machine forward to it — the AI never sets state. */
export interface ConversationTurn {
  reply: string;
  targetState: ChatSessionState;
  summary: ConfirmationSummary | null;
  reviewFlagged: boolean;
}

/**
 * Conversation engine port. Day 2 binds a deterministic placeholder; Day 3
 * binds the AI-backed Vera orchestrator. Both perform their own side effects
 * (extraction persistence, lead merge) and return the assistant turn.
 */
export interface ConversationEngine {
  handle(ctx: ConversationContext): Promise<ConversationTurn>;
}
