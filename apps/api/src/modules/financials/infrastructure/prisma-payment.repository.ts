import type { Payment as PaymentRow, PrismaClient } from '@prisma/client';
import type { Page, PaymentDto } from '../application/dto.js';
import type {
  CreatePaymentInput,
  ListOptions,
  PaymentRepository,
  UpdatePaymentInput,
} from '../application/ports.js';

/** Tenant- and project-scoped payment persistence. */
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    companyId: string,
    projectId: string,
    input: CreatePaymentInput,
  ): Promise<PaymentDto> {
    const row = await this.prisma.payment.create({
      data: {
        companyId,
        projectId,
        amountCents: input.amountCents,
        method: input.method,
        type: input.type,
        reference: input.reference ?? null,
        receivedAt: input.receivedAt,
        notes: input.notes ?? null,
      },
    });
    return toDto(row);
  }

  async list(
    companyId: string,
    projectId: string,
    options: ListOptions,
  ): Promise<Page<PaymentDto>> {
    const where = { companyId, projectId };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items: rows.map(toDto), total, limit: options.limit, offset: options.offset };
  }

  async findById(companyId: string, projectId: string, id: string): Promise<PaymentDto | null> {
    const row = await this.prisma.payment.findFirst({ where: { id, companyId, projectId } });
    return row ? toDto(row) : null;
  }

  async update(
    companyId: string,
    projectId: string,
    id: string,
    input: UpdatePaymentInput,
  ): Promise<PaymentDto | null> {
    const result = await this.prisma.payment.updateMany({
      where: { id, companyId, projectId },
      data: pruneUndefined(input),
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.prisma.payment.findFirst({ where: { id, companyId, projectId } });
    return row ? toDto(row) : null;
  }

  async delete(companyId: string, projectId: string, id: string): Promise<boolean> {
    const result = await this.prisma.payment.deleteMany({ where: { id, companyId, projectId } });
    return result.count > 0;
  }
}

function toDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    projectId: row.projectId,
    amountCents: row.amountCents,
    currency: row.currency,
    method: row.method,
    type: row.type,
    reference: row.reference,
    receivedAt: row.receivedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function pruneUndefined<T extends Record<string, unknown>>(
  input: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}
