import type { ChatSessionState } from '@verza/shared';

/**
 * Domain view of a chat session. Infrastructure maps Prisma rows into this
 * shape; Prisma models never cross the module boundary.
 */
export interface ChatSession {
  id: string;
  leadId: string;
  leadReference: string;
  state: ChatSessionState;
  expiresAt: Date;
  resumeTokenRevokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatMessageRole = 'CUSTOMER' | 'VERA' | 'SYSTEM';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: Date;
}
