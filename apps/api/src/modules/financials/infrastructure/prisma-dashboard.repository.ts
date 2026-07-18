import { QuoteStatus, type PrismaClient } from '@prisma/client';
import type { DashboardFacts, DashboardPeriod, DashboardRepository } from '../application/ports.js';

const ACTIVE_QUOTE_STATUSES = [QuoteStatus.APPROVED, QuoteStatus.SENT, QuoteStatus.ACCEPTED];

/** Tenant-scoped read model for deterministic owner dashboard metrics. */
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async load(companyId: string, period: DashboardPeriod): Promise<DashboardFacts> {
    const [
      projects,
      statusGroups,
      costs,
      marketing,
      payments,
      activeQuotes,
      quotesSentThisMonth,
      leadCount,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: { companyId },
        select: {
          id: true,
          status: true,
          serviceType: true,
          customerId: true,
          contractAmountCents: true,
          contractSignedAt: true,
        },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.projectCost.findMany({
        where: { companyId },
        select: {
          projectId: true,
          category: true,
          totalCents: true,
          purchaseDate: true,
        },
      }),
      this.prisma.marketingSpend.findMany({
        where: { companyId },
        select: {
          projectId: true,
          amountCents: true,
          spentAt: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { companyId },
        select: {
          amountCents: true,
          type: true,
          receivedAt: true,
        },
      }),
      this.prisma.officialQuote.findMany({
        where: { companyId, status: { in: ACTIVE_QUOTE_STATUSES } },
        orderBy: [{ projectId: 'asc' }, { version: 'desc' }],
        select: {
          projectId: true,
          totalCents: true,
          version: true,
          sentAt: true,
        },
      }),
      this.prisma.officialQuote.count({
        where: {
          companyId,
          sentAt: { gte: period.start, lt: period.end },
        },
      }),
      this.prisma.lead.count({ where: { companyId } }),
    ]);

    const seenProjectIds = new Set<string>();
    const latestActiveQuotes = activeQuotes.filter((quote) => {
      if (seenProjectIds.has(quote.projectId)) {
        return false;
      }
      seenProjectIds.add(quote.projectId);
      return true;
    });

    return {
      projects,
      projectStatusCounts: statusGroups.map((group) => ({
        status: group.status,
        count: group._count._all,
      })),
      costs,
      marketing,
      payments,
      latestActiveQuotes,
      quotesSentThisMonth,
      leadCount,
    };
  }
}
