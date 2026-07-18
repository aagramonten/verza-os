import { Prisma, type PrismaClient, type Project as ProjectRow } from '@prisma/client';
import type { Page, ProjectDto } from '../application/dto.js';
import type {
  CreateProjectInput,
  ListOptions,
  ProjectRepository,
  UpdateProjectInput,
} from '../application/ports.js';

/**
 * Tenant-scoped project persistence. Every query filters on the companyId
 * passed by the application layer (sourced from the verified token), so a
 * caller can never read or mutate another tenant's projects.
 */
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(companyId: string, input: CreateProjectInput): Promise<ProjectDto> {
    // Retry on the (rare) reference-number race; the unique index is the guard.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const referenceNumber = await this.nextReference();
      try {
        const row = await this.prisma.project.create({
          data: {
            companyId,
            referenceNumber,
            title: input.title ?? null,
            serviceType: input.serviceType ?? null,
            status: input.status ?? 'PLANNED',
            scope: input.scope ?? null,
            notes: input.notes ?? null,
            contractAmountCents: input.contractAmountCents ?? null,
            contractSignedAt: input.contractSignedAt ?? null,
            wonAt: input.wonAt ?? null,
            startedAt: input.startedAt ?? null,
            completedAt: input.completedAt ?? null,
            leadId: input.leadId ?? null,
            customerId: input.customerId ?? null,
          },
        });
        return toDto(row);
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 4) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to allocate a unique project reference number');
  }

  async findById(companyId: string, id: string): Promise<ProjectDto | null> {
    const row = await this.prisma.project.findFirst({ where: { id, companyId } });
    return row ? toDto(row) : null;
  }

  async list(companyId: string, options: ListOptions): Promise<Page<ProjectDto>> {
    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      this.prisma.project.count({ where: { companyId } }),
    ]);
    return { items: rows.map(toDto), total, limit: options.limit, offset: options.offset };
  }

  async update(
    companyId: string,
    id: string,
    input: UpdateProjectInput,
  ): Promise<ProjectDto | null> {
    // Scope the update to the tenant: updateMany returns 0 for a foreign id.
    const result = await this.prisma.project.updateMany({
      where: { id, companyId },
      data: pruneUndefined(input),
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.prisma.project.findFirst({ where: { id, companyId } });
    return row ? toDto(row) : null;
  }

  private async nextReference(): Promise<string> {
    const count = await this.prisma.project.count();
    return `VGP-${String(count + 1).padStart(4, '0')}`;
  }
}

function toDto(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    companyId: row.companyId,
    referenceNumber: row.referenceNumber,
    title: row.title,
    serviceType: row.serviceType,
    status: row.status,
    scope: row.scope,
    notes: row.notes,
    currency: row.currency,
    contractAmountCents: row.contractAmountCents,
    contractSignedAt: row.contractSignedAt,
    wonAt: row.wonAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    leadId: row.leadId,
    customerId: row.customerId,
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

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
