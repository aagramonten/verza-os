import type { FollowUpStatus, Prisma, PrismaClient } from '@prisma/client';
import type {
  LeadDetailDto,
  LeadListItemDto,
  LeadListOptions,
  LeadRepository,
  Page,
} from '../application/ports.js';

const customerSelect = {
  select: { name: true, phone: true, email: true, municipality: true },
} as const;

type LeadRow = Prisma.LeadGetPayload<{ include: { customer: typeof customerSelect } }>;

export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(companyId: string, options: LeadListOptions): Promise<Page<LeadListItemDto>> {
    const where: Prisma.LeadWhereInput = {
      companyId,
      ...(options.followUpStatus ? { followUpStatus: options.followUpStatus } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: { customer: customerSelect },
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      items: rows.map(toListItem),
      total,
      limit: options.limit,
      offset: options.offset,
    };
  }

  async findById(companyId: string, id: string): Promise<LeadDetailDto | null> {
    const row = await this.prisma.lead.findFirst({
      where: { id, companyId },
      include: { customer: customerSelect },
    });
    if (!row) {
      return null;
    }
    return this.toDetail(row);
  }

  async updateFollowUpStatus(
    companyId: string,
    id: string,
    status: FollowUpStatus,
  ): Promise<LeadDetailDto | null> {
    const { count } = await this.prisma.lead.updateMany({
      where: { id, companyId },
      data: { followUpStatus: status },
    });
    if (count === 0) {
      return null;
    }
    return this.findById(companyId, id);
  }

  private async toDetail(row: LeadRow): Promise<LeadDetailDto> {
    const photoCount = await this.prisma.leadMedia.count({
      where: { leadId: row.id, companyId: row.companyId, kind: 'PHOTO' },
    });
    return {
      ...toListItem(row),
      desiredDate: row.desiredDate?.toISOString() ?? null,
      preferredVisitTime: row.preferredVisitTime,
      adminSummary: row.adminSummary,
      leadScore: row.leadScore,
      conversionBand: row.conversionBand,
      suggestedNextAction: row.suggestedNextAction,
      photoCount,
    };
  }
}

function toListItem(row: LeadRow): LeadListItemDto {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    status: row.status,
    followUpStatus: row.followUpStatus,
    serviceType: row.serviceType,
    description: row.description,
    budgetMinCents: row.budgetMinCents,
    budgetMaxCents: row.budgetMaxCents,
    customer: row.customer
      ? {
          name: row.customer.name,
          phone: row.customer.phone,
          email: row.customer.email,
          municipality: row.customer.municipality,
        }
      : null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
