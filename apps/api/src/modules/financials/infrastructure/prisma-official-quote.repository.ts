import {
  Prisma,
  type OfficialQuote as OfficialQuoteRow,
  type PrismaClient,
  type QuoteStatus,
  type UserRole,
} from '@prisma/client';
import { AuditLogService } from '../../../shared/audit/audit-log.service.js';
import type { OfficialQuoteDto, OfficialQuoteLineItemDto, Page } from '../application/dto.js';
import type {
  CreateOfficialQuoteResult,
  ListOptions,
  OfficialQuoteRepository,
  OfficialQuoteSnapshot,
  OfficialQuoteTransitionCommand,
  OfficialQuoteTransitionResult,
  RequoteResult,
} from '../application/ports.js';
import { priceQuote, QuoteDomainError, transitionQuote } from '../domain/quote.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
const HUMAN_QUOTE_ROLES: UserRole[] = ['OWNER', 'ADMIN'];

/**
 * Tenant-scoped quote persistence. State changes and their audit evidence are
 * committed in the same serializable transaction.
 */
export class PrismaOfficialQuoteRepository implements OfficialQuoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createInitialDraft(input: {
    companyId: string;
    projectId: string;
    actorId: string;
    actorRole: UserRole;
    snapshot: OfficialQuoteSnapshot;
  }): Promise<CreateOfficialQuoteResult> {
    try {
      return await this.transaction(async (tx) => {
        if (!(await humanActorExists(tx, input.companyId, input.actorId, input.actorRole))) {
          return { kind: 'actor-not-allowed' };
        }
        const project = await tx.project.findFirst({
          where: { id: input.projectId, companyId: input.companyId },
          select: { currency: true },
        });
        if (!project) {
          return { kind: 'project-not-found' };
        }

        const existing = await tx.officialQuote.findFirst({
          where: { companyId: input.companyId, projectId: input.projectId },
          select: { id: true },
        });
        if (existing) {
          return { kind: 'already-exists' };
        }

        const row = await tx.officialQuote.create({
          data: {
            companyId: input.companyId,
            projectId: input.projectId,
            version: 1,
            status: 'DRAFT',
            currency: project.currency,
            ...snapshotData(input.snapshot),
          },
        });
        await this.audit(tx, input.companyId, {
          actorId: input.actorId,
          action: 'financials.quote.created',
          quote: row,
          fromStatus: null,
          toStatus: 'DRAFT',
        });
        return { kind: 'created', quote: toDto(row) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'already-exists' };
      }
      throw error;
    }
  }

  async findById(
    companyId: string,
    projectId: string,
    quoteId: string,
  ): Promise<OfficialQuoteDto | null> {
    const row = await this.prisma.officialQuote.findFirst({
      where: { id: quoteId, projectId, companyId },
    });
    return row ? toDto(row) : null;
  }

  async list(
    companyId: string,
    projectId: string,
    options: ListOptions,
  ): Promise<Page<OfficialQuoteDto> | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) {
      return null;
    }

    const where = { companyId, projectId };
    const [rows, total] = await Promise.all([
      this.prisma.officialQuote.findMany({
        where,
        orderBy: { version: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      this.prisma.officialQuote.count({ where }),
    ]);
    return {
      items: rows.map(toDto),
      total,
      limit: options.limit,
      offset: options.offset,
    };
  }

  async transition(input: OfficialQuoteTransitionCommand): Promise<OfficialQuoteTransitionResult> {
    return this.transaction(async (tx) => {
      if (!(await humanActorExists(tx, input.companyId, input.actorId, input.actorRole))) {
        return { kind: 'actor-not-allowed' };
      }

      const current = await tx.officialQuote.findFirst({
        where: {
          id: input.quoteId,
          projectId: input.projectId,
          companyId: input.companyId,
        },
      });
      if (!current) {
        return { kind: 'not-found' };
      }
      if (!isPersistedSnapshotValid(current)) {
        return { kind: 'invalid-snapshot' };
      }
      if (current.status === input.toStatus) {
        return { kind: 'unchanged', quote: toDto(current) };
      }
      if (current.status !== input.fromStatus) {
        return { kind: 'conflict', currentStatus: current.status };
      }
      if (!current.validUntil || current.validUntil <= input.at) {
        return { kind: 'expired' };
      }

      const update = await tx.officialQuote.updateMany({
        where: {
          id: input.quoteId,
          projectId: input.projectId,
          companyId: input.companyId,
          status: input.fromStatus,
        },
        data: transitionData(input),
      });

      if (update.count === 0) {
        const changed = await tx.officialQuote.findFirst({
          where: {
            id: input.quoteId,
            projectId: input.projectId,
            companyId: input.companyId,
          },
        });
        if (!changed) {
          return { kind: 'not-found' };
        }
        if (!isPersistedSnapshotValid(changed)) {
          return { kind: 'invalid-snapshot' };
        }
        if (changed.status === input.toStatus) {
          return { kind: 'unchanged', quote: toDto(changed) };
        }
        if (
          changed.status === input.fromStatus &&
          (!changed.validUntil || changed.validUntil <= input.at)
        ) {
          return { kind: 'expired' };
        }
        return { kind: 'conflict', currentStatus: changed.status };
      }

      const updated = await tx.officialQuote.findFirstOrThrow({
        where: {
          id: input.quoteId,
          projectId: input.projectId,
          companyId: input.companyId,
        },
      });
      await this.audit(tx, input.companyId, {
        actorId: input.actorId,
        action: auditActionFor(input.action),
        quote: updated,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
      });
      return { kind: 'updated', quote: toDto(updated) };
    });
  }

  async requote(input: {
    companyId: string;
    projectId: string;
    quoteId: string;
    actorId: string;
    actorRole: UserRole;
    at: Date;
    snapshot: OfficialQuoteSnapshot;
  }): Promise<RequoteResult> {
    return this.transaction(async (tx) => {
      if (!(await humanActorExists(tx, input.companyId, input.actorId, input.actorRole))) {
        return { kind: 'actor-not-allowed' };
      }

      const [current, project, latest] = await Promise.all([
        tx.officialQuote.findFirst({
          where: {
            id: input.quoteId,
            projectId: input.projectId,
            companyId: input.companyId,
          },
        }),
        tx.project.findFirst({
          where: { id: input.projectId, companyId: input.companyId },
          select: { currency: true },
        }),
        tx.officialQuote.findFirst({
          where: { projectId: input.projectId, companyId: input.companyId },
          orderBy: { version: 'desc' },
          select: { version: true },
        }),
      ]);
      if (!current || !project || !latest) {
        return { kind: 'not-found' };
      }
      try {
        transitionQuote(current.status, 'REQUOTE');
      } catch (error) {
        if (error instanceof QuoteDomainError && error.code === 'INVALID_TRANSITION') {
          return { kind: 'conflict', currentStatus: current.status };
        }
        throw error;
      }
      if (latest.version !== current.version) {
        return { kind: 'conflict', currentStatus: current.status };
      }

      const superseded = await tx.officialQuote.updateMany({
        where: {
          id: current.id,
          projectId: input.projectId,
          companyId: input.companyId,
          status: current.status,
          version: current.version,
        },
        data: { status: 'SUPERSEDED' },
      });
      if (superseded.count === 0) {
        const changed = await tx.officialQuote.findFirst({
          where: { id: current.id, projectId: input.projectId, companyId: input.companyId },
          select: { status: true },
        });
        return changed
          ? { kind: 'conflict', currentStatus: changed.status }
          : { kind: 'not-found' };
      }

      const replacement = await tx.officialQuote.create({
        data: {
          companyId: input.companyId,
          projectId: input.projectId,
          version: current.version + 1,
          status: 'DRAFT',
          currency: project.currency,
          ...snapshotData(input.snapshot),
        },
      });
      await this.audit(tx, input.companyId, {
        actorId: input.actorId,
        action: 'financials.quote.superseded',
        quote: current,
        fromStatus: current.status,
        toStatus: 'SUPERSEDED',
        extra: { replacementQuoteId: replacement.id },
      });
      await this.audit(tx, input.companyId, {
        actorId: input.actorId,
        action: 'financials.quote.requoted',
        quote: replacement,
        fromStatus: null,
        toStatus: 'DRAFT',
        extra: { previousQuoteId: current.id, previousVersion: current.version },
      });
      return { kind: 'created', quote: toDto(replacement) };
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: {
      actorId: string;
      action: string;
      quote: Pick<OfficialQuoteRow, 'id' | 'projectId' | 'version'>;
      fromStatus: QuoteStatus | null;
      toStatus: QuoteStatus;
      extra?: Record<string, unknown>;
    },
  ): Promise<void> {
    await new AuditLogService(tx, companyId).record({
      actorType: 'ADMIN',
      actorId: input.actorId,
      action: input.action,
      entity: 'official_quote',
      entityId: input.quote.id,
      data: {
        projectId: input.quote.projectId,
        version: input.quote.version,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        ...input.extra,
      },
    });
  }

  private async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (isTransactionConflict(error) && attempt < MAX_TRANSACTION_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Official quote transaction retry limit exceeded');
  }
}

function snapshotData(
  snapshot: OfficialQuoteSnapshot,
): Pick<
  Prisma.OfficialQuoteUncheckedCreateInput,
  'lineItems' | 'subtotalCents' | 'taxRateBps' | 'taxCents' | 'totalCents' | 'validUntil' | 'notes'
> {
  return {
    lineItems: snapshot.lineItems as unknown as Prisma.InputJsonValue,
    subtotalCents: snapshot.subtotalCents,
    taxRateBps: snapshot.taxRateBps,
    taxCents: snapshot.taxCents,
    totalCents: snapshot.totalCents,
    validUntil: snapshot.validUntil,
    notes: snapshot.notes,
  };
}

function transitionData(
  input: OfficialQuoteTransitionCommand,
): Prisma.OfficialQuoteUncheckedUpdateManyInput {
  if (input.action === 'APPROVE') {
    return {
      status: input.toStatus,
      approvedByUserId: input.actorId,
      approvedAt: input.at,
    };
  }
  if (input.action === 'SEND') {
    return { status: input.toStatus, sentAt: input.at };
  }
  return { status: input.toStatus };
}

function auditActionFor(action: OfficialQuoteTransitionCommand['action']): string {
  if (action === 'SUBMIT_FOR_APPROVAL') return 'financials.quote.submitted';
  if (action === 'APPROVE') return 'financials.quote.approved';
  return 'financials.quote.sent';
}

async function humanActorExists(
  tx: Prisma.TransactionClient,
  companyId: string,
  actorId: string,
  actorRole: UserRole,
): Promise<boolean> {
  if (!HUMAN_QUOTE_ROLES.includes(actorRole)) {
    return false;
  }
  const actor = await tx.user.findFirst({
    where: {
      id: actorId,
      companyId,
      role: actorRole,
    },
    select: { id: true },
  });
  return actor !== null;
}

function toDto(row: OfficialQuoteRow): OfficialQuoteDto {
  return {
    id: row.id,
    projectId: row.projectId,
    version: row.version,
    status: row.status,
    currency: row.currency,
    lineItems: parseLineItems(row.lineItems),
    subtotalCents: row.subtotalCents,
    taxRateBps: row.taxRateBps,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    validUntil: row.validUntil,
    approvedAt: row.approvedAt,
    sentAt: row.sentAt,
    acceptedAt: row.acceptedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseLineItems(value: Prisma.JsonValue | null): OfficialQuoteLineItemDto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsed: OfficialQuoteLineItemDto[] = [];
  for (const item of value) {
    if (
      typeof item !== 'object' ||
      item === null ||
      Array.isArray(item) ||
      typeof item['description'] !== 'string' ||
      !Number.isSafeInteger(item['quantityMilli']) ||
      !Number.isSafeInteger(item['unitPriceCents']) ||
      !Number.isSafeInteger(item['lineTotalCents'])
    ) {
      return [];
    }
    parsed.push({
      description: item['description'],
      quantityMilli: item['quantityMilli'] as number,
      unitPriceCents: item['unitPriceCents'] as number,
      lineTotalCents: item['lineTotalCents'] as number,
    });
  }
  return parsed;
}

function isPersistedSnapshotValid(row: OfficialQuoteRow): boolean {
  if (row.taxRateBps === null || row.validUntil === null || !/^[A-Z]{3}$/.test(row.currency)) {
    return false;
  }
  const lineItems = parseLineItems(row.lineItems);
  if (lineItems.length === 0) {
    return false;
  }

  try {
    const priced = priceQuote({
      lineItems,
      taxRateBps: row.taxRateBps,
    });
    if (
      priced.subtotalCents !== row.subtotalCents ||
      priced.taxCents !== row.taxCents ||
      priced.totalCents !== row.totalCents ||
      priced.lineItems.some(
        (line, index) =>
          line.description !== lineItems[index]?.description ||
          line.quantityMilli !== lineItems[index]?.quantityMilli ||
          line.unitPriceCents !== lineItems[index]?.unitPriceCents ||
          line.lineTotalCents !== lineItems[index]?.lineTotalCents,
      )
    ) {
      return false;
    }
  } catch (error) {
    if (error instanceof QuoteDomainError) {
      return false;
    }
    throw error;
  }

  if (
    (row.status === 'APPROVED' || row.status === 'SENT' || row.status === 'ACCEPTED') &&
    (!row.approvedByUserId || !row.approvedAt)
  ) {
    return false;
  }
  if ((row.status === 'SENT' || row.status === 'ACCEPTED') && !row.sentAt) {
    return false;
  }
  return row.status !== 'ACCEPTED' || row.acceptedAt !== null;
}

function isTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
