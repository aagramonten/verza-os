import type { PrismaClient } from '@prisma/client';
import type { ChatMessage, ChatMessageRole } from '../domain/chat-session.js';
import type { ChatMessageRepository } from '../application/ports.js';

/**
 * Append-only message store. No update/delete methods exist by design and
 * none may be added (Day 2 spec: messages are immutable).
 */
export class PrismaChatMessageRepository implements ChatMessageRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  async append(sessionId: string, role: ChatMessageRole, content: string): Promise<ChatMessage> {
    const row = await this.prisma.chatMessage.create({
      data: { companyId: this.companyId, sessionId, role, content },
    });
    return {
      id: row.id,
      sessionId: row.sessionId,
      role,
      content: row.content,
      createdAt: row.createdAt,
    };
  }

  async listAscending(sessionId: string): Promise<ChatMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId, companyId: this.companyId },
      // id as tiebreaker keeps ordering deterministic for same-millisecond rows
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    }));
  }

  async count(sessionId: string): Promise<number> {
    return this.prisma.chatMessage.count({ where: { sessionId, companyId: this.companyId } });
  }
}
