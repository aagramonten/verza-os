import type { ActorType, Prisma, PrismaClient } from '@prisma/client';

type AuditLogClient = Pick<PrismaClient, 'auditLog'>;

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  data?: Record<string, unknown>;
}

/**
 * Append-only audit writer. This is the ONLY code path that touches
 * audit_logs — there is intentionally no update or delete method, and none
 * may ever be added (docs/vera-chat-mvp-plan.md §8.11).
 */
export class AuditLogService {
  constructor(
    private readonly prisma: AuditLogClient,
    private readonly companyId: string,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        companyId: this.companyId,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        ...(entry.data !== undefined ? { data: entry.data as Prisma.InputJsonValue } : {}),
      },
    });
  }
}
