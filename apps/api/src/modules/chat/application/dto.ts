import type { ChatSessionState } from '@verza/shared';
import type { ChatMessage, ChatSession } from '../domain/chat-session.js';
import type { ConfirmationSummary } from './summary.js';

/**
 * Public DTOs — the ONLY shapes that leave the API on public chat endpoints.
 * They must never carry: companyId, ipHash, userAgent, token hashes, scores,
 * audit data, or any internal identifier beyond the session id and lead
 * reference. Widening these types is a security decision, not a convenience.
 */

export interface PublicMessageDto {
  id: string;
  role: 'CUSTOMER' | 'VERA';
  content: string;
  createdAt: string;
}

export interface PublicSessionDto {
  sessionId: string;
  leadReference: string;
  state: ChatSessionState;
  messages: PublicMessageDto[];
  summary: ConfirmationSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSessionCreatedDto {
  sessionId: string;
  leadReference: string;
  state: ChatSessionState;
  resumeToken: string;
  createdAt: string;
}

export interface PublicStatusDto {
  state: ChatSessionState;
  leadReference: string;
  messageCount: number;
  updatedAt: string;
}

export interface PublicMessagesCreatedDto {
  messages: PublicMessageDto[];
  state: ChatSessionState;
  summary: ConfirmationSummary | null;
}

export function toPublicMessage(message: ChatMessage): PublicMessageDto {
  return {
    id: message.id,
    // SYSTEM messages are internal-only and are filtered out before mapping.
    role: message.role === 'CUSTOMER' ? 'CUSTOMER' : 'VERA',
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toPublicSession(
  session: ChatSession,
  messages: ChatMessage[],
  summary: ConfirmationSummary | null = null,
): PublicSessionDto {
  return {
    sessionId: session.id,
    leadReference: session.leadReference,
    state: session.state,
    messages: messages.filter((m) => m.role !== 'SYSTEM').map(toPublicMessage),
    summary,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
