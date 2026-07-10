import type { ChatSessionState, PrismaClient } from '@prisma/client';
import type { ChatSessionState as SharedState } from '@verza/shared';
import type { ChatSession } from '../domain/chat-session.js';
import type { ChatSessionRepository, CreateSessionInput } from '../application/ports.js';

type SessionRow = {
  id: string;
  leadId: string | null;
  state: ChatSessionState;
  expiresAt: Date;
  resumeTokenRevokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lead: { referenceNumber: string } | null;
};

/**
 * Tenant-scoped Prisma adapter. companyId comes exclusively from the
 * constructor (application context) — never from request input — and every
 * query filters on it.
 */
export class PrismaChatSessionRepository implements ChatSessionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  async create(input: CreateSessionInput): Promise<ChatSession> {
    const row = await this.prisma.chatSession.create({
      data: {
        companyId: this.companyId,
        leadId: input.leadId,
        resumeTokenHash: input.resumeTokenHash,
        expiresAt: input.expiresAt,
        ipHash: input.ipHash,
        userAgent: input.userAgent,
      },
      include: { lead: { select: { referenceNumber: true } } },
    });
    return this.toDomain(row);
  }

  async findById(sessionId: string): Promise<ChatSession | null> {
    const row = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, companyId: this.companyId },
      include: { lead: { select: { referenceNumber: true } } },
    });
    return row === null ? null : this.toDomain(row);
  }

  async findTokenHash(sessionId: string): Promise<string | null> {
    const row = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, companyId: this.companyId },
      select: { resumeTokenHash: true },
    });
    return row?.resumeTokenHash ?? null;
  }

  async updateState(sessionId: string, state: SharedState): Promise<void> {
    await this.prisma.chatSession.updateMany({
      where: { id: sessionId, companyId: this.companyId },
      data: { state },
    });
  }

  async touch(sessionId: string, at: Date): Promise<void> {
    await this.prisma.chatSession.updateMany({
      where: { id: sessionId, companyId: this.companyId },
      data: { lastActivityAt: at },
    });
  }

  async revokeToken(sessionId: string, at: Date): Promise<void> {
    await this.prisma.chatSession.updateMany({
      where: { id: sessionId, companyId: this.companyId },
      data: { resumeTokenRevokedAt: at },
    });
  }

  private toDomain(row: SessionRow): ChatSession {
    if (row.leadId === null || row.lead === null) {
      // Sessions are always created with a lead (createSession); a row
      // without one indicates data corruption, not a user error.
      throw new Error(`Chat session ${row.id} has no associated lead`);
    }
    return {
      id: row.id,
      leadId: row.leadId,
      leadReference: row.lead.referenceNumber,
      state: row.state,
      expiresAt: row.expiresAt,
      resumeTokenRevokedAt: row.resumeTokenRevokedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
