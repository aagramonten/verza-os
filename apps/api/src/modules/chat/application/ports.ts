import type { ChatSessionState } from '@verza/shared';
import type { ChatMessage, ChatMessageRole, ChatSession } from '../domain/chat-session.js';

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
  /** Registers a hit for the key and reports whether it is allowed. */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number };
}

/**
 * Assistant responder port. Day 2 binds the deterministic placeholder;
 * Day 3 replaces it with the AI orchestration layer behind the same contract.
 */
export interface AssistantResponder {
  respond(input: { state: ChatSessionState; customerMessageCount: number }): {
    reply: string;
    nextState: ChatSessionState | null;
  };
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
  /** Returns the stored token hash for verification. Never leaves the application layer. */
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
  /** Creates a DRAFT lead with the next free VG-##### reference. */
  createDraft(): Promise<{ id: string; referenceNumber: string }>;
}
