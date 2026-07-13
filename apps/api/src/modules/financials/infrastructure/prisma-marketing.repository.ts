import type { MarketingSpend as MarketingRow, PrismaClient } from '@prisma/client';
import type { MarketingSpendDto, Page } from '../application/dto.js';
import type {
  CreateMarketingSpendInput,
  MarketingSpendListFilter,
  MarketingSpendRepository,
  UpdateMarketingSpendInput,
} from '../application/ports.js';

/** Tenant-scoped advertising-spend persistence. */
export class PrismaMarketingSpendRepository implements MarketingSpendRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(companyId: string, input: CreateMarketingSpendInput): Promise<MarketingSpendDto> {
    const row = await this.prisma.marketingSpend.create({
      data: {
        companyId,
        channel: input.channel,
        description: input.description ?? null,
        amountCents: input.amountCents,
        spentAt: input.spentAt,
        projectId: input.projectId ?? null,
        campaignRef: input.campaignRef ?? null,
      },
    });
    return toDto(row);
  }

  async list(companyId: string, filter: MarketingSpendListFilter): Promise<Page<MarketingSpendDto>> {
    const where = {
      companyId,
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
      ...(filter.channel ? { channel: filter.channel } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.marketingSpend.findMany({
        where,
        orderBy: { spentAt: 'desc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.marketingSpend.count({ where }),
    ]);
    return { items: rows.map(toDto), total, limit: filter.limit, offset: filter.offset };
  }

  async findById(companyId: string, id: string): Promise<MarketingSpendDto | null> {
    const row = await this.prisma.marketingSpend.findFirst({ where: { id, companyId } });
    return row ? toDto(row) : null;
  }

  async update(
    companyId: string,
    id: string,
    input: UpdateMarketingSpendInput,
  ): Promise<MarketingSpendDto | null> {
    const result = await this.prisma.marketingSpend.updateMany({
      where: { id, companyId },
      data: pruneUndefined(input),
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.prisma.marketingSpend.findFirst({ where: { id, companyId } });
    return row ? toDto(row) : null;
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const result = await this.prisma.marketingSpend.deleteMany({ where: { id, companyId } });
    return result.count > 0;
  }
}

function toDto(row: MarketingRow): MarketingSpendDto {
  return {
    id: row.id,
    channel: row.channel,
    description: row.description,
    amountCents: row.amountCents,
    currency: row.currency,
    spentAt: row.spentAt,
    projectId: row.projectId,
    campaignRef: row.campaignRef,
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
