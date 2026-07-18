import type { PrismaClient, ProjectCost as CostRow } from '@prisma/client';
import type { CostDto, Page } from '../application/dto.js';
import type {
  CostRepository,
  CreateCostInput,
  ListOptions,
  UpdateCostInput,
} from '../application/ports.js';

/** Tenant- and project-scoped cost persistence. */
export class PrismaCostRepository implements CostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(companyId: string, projectId: string, input: CreateCostInput): Promise<CostDto> {
    const row = await this.prisma.projectCost.create({
      data: {
        companyId,
        projectId,
        category: input.category,
        description: input.description,
        vendor: input.vendor ?? null,
        quantity: input.quantity,
        unitCostCents: input.unitCostCents,
        totalCents: input.totalCents,
        purchaseDate: input.purchaseDate,
        receiptKey: input.receiptKey ?? null,
        notes: input.notes ?? null,
      },
    });
    return toDto(row);
  }

  async list(companyId: string, projectId: string, options: ListOptions): Promise<Page<CostDto>> {
    const where = { companyId, projectId };
    const [rows, total] = await Promise.all([
      this.prisma.projectCost.findMany({
        where,
        orderBy: { purchaseDate: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      this.prisma.projectCost.count({ where }),
    ]);
    return { items: rows.map(toDto), total, limit: options.limit, offset: options.offset };
  }

  async findById(companyId: string, projectId: string, id: string): Promise<CostDto | null> {
    const row = await this.prisma.projectCost.findFirst({ where: { id, companyId, projectId } });
    return row ? toDto(row) : null;
  }

  async update(
    companyId: string,
    projectId: string,
    id: string,
    input: UpdateCostInput,
  ): Promise<CostDto | null> {
    const result = await this.prisma.projectCost.updateMany({
      where: { id, companyId, projectId },
      data: pruneUndefined(input),
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.prisma.projectCost.findFirst({ where: { id, companyId, projectId } });
    return row ? toDto(row) : null;
  }

  async delete(companyId: string, projectId: string, id: string): Promise<boolean> {
    const result = await this.prisma.projectCost.deleteMany({ where: { id, companyId, projectId } });
    return result.count > 0;
  }
}

function toDto(row: CostRow): CostDto {
  return {
    id: row.id,
    projectId: row.projectId,
    category: row.category,
    description: row.description,
    vendor: row.vendor,
    quantity: row.quantity.toNumber(),
    unitCostCents: row.unitCostCents,
    totalCents: row.totalCents,
    currency: row.currency,
    purchaseDate: row.purchaseDate,
    receiptKey: row.receiptKey,
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
