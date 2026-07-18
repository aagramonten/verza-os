import type { ServiceType } from '@prisma/client';
import type { DashboardDto } from './dashboard.dto.js';
import type {
  Actor,
  Clock,
  DashboardCostFact,
  DashboardMarketingFact,
  DashboardProjectFact,
  DashboardRepository,
} from './ports.js';
import { averageCents, meetsGoal, percent } from '../domain/metrics.js';
import { monthRange } from '../domain/period.js';

const HERO_GOALS = {
  quotesSentThisMonth: 24,
  averageTicketCents: 230_000,
  netProfitPerProjectCents: 130_000,
};

export interface DashboardServiceDeps {
  dashboard: DashboardRepository;
  clock: Clock;
}

/** Tenant-scoped owner financial dashboard. All metrics are recomputed on read. */
export class DashboardService {
  constructor(private readonly deps: DashboardServiceDeps) {}

  async get(actor: Actor): Promise<DashboardDto> {
    const period = monthRange(this.deps.clock.now());
    const facts = await this.deps.dashboard.load(actor.companyId, period);
    const activeProjects = facts.projects.filter((project) => project.status !== 'CANCELLED');
    const withContract = activeProjects.filter((project) => project.contractAmountCents !== null);

    const contractCents = sum(activeProjects.map((project) => project.contractAmountCents ?? 0));
    const quotedCents = sum(facts.latestActiveQuotes.map((quote) => quote.totalCents));
    const collectedCents = netPayments(facts.payments);
    const projectCostsCents = sum(facts.costs.map((cost) => cost.totalCents));
    const marketingSpendCents = sum(facts.marketing.map((spend) => spend.amountCents));
    const totalCostsCents = projectCostsCents + marketingSpendCents;
    const grossCents = contractCents - projectCostsCents;
    const netCents = grossCents - marketingSpendCents;
    const averageTicketCents = averageCents(contractCents, withContract.length);
    const netProfitPerProjectCents = averageCents(netCents, activeProjects.length);
    const thisMonthProjectCosts = sum(
      facts.costs
        .filter((cost) => inPeriod(cost.purchaseDate, period.start, period.end))
        .map((cost) => cost.totalCents),
    );
    const thisMonthMarketing = sum(
      facts.marketing
        .filter((spend) => inPeriod(spend.spentAt, period.start, period.end))
        .map((spend) => spend.amountCents),
    );
    const contractSignedThisMonth = sum(
      activeProjects
        .filter(
          (project) =>
            project.contractSignedAt !== null &&
            inPeriod(project.contractSignedAt, period.start, period.end),
        )
        .map((project) => project.contractAmountCents ?? 0),
    );
    const collectedThisMonth = netPayments(
      facts.payments.filter((payment) => inPeriod(payment.receivedAt, period.start, period.end)),
    );

    return {
      currency: 'USD',
      period,
      revenue: {
        quotedCents,
        contractCents,
        collectedCents,
        outstandingCents: contractCents - collectedCents,
      },
      thisMonth: {
        contractSignedCents: contractSignedThisMonth,
        collectedCents: collectedThisMonth,
        costsCents: thisMonthProjectCosts + thisMonthMarketing,
        quotesSent: facts.quotesSentThisMonth,
      },
      costs: {
        projectCostsCents,
        marketingSpendCents,
        totalCents: totalCostsCents,
        breakdown: costBreakdown(facts.costs),
      },
      profit: {
        grossCents,
        netCents,
        grossMarginPct: percent(grossCents, contractCents),
        netMarginPct: percent(netCents, contractCents),
        averagePerProjectCents: netProfitPerProjectCents,
        roiPct: percent(netCents, totalCostsCents),
      },
      averages: {
        ticketCents: averageTicketCents,
      },
      projects: {
        total: activeProjects.length,
        withContract: withContract.length,
        byStatus: facts.projectStatusCounts,
      },
      profitByService: profitByService(activeProjects, facts.costs, facts.marketing),
      marketing: {
        totalCents: marketingSpendCents,
        costPerLeadCents: averageCents(marketingSpendCents, facts.leadCount),
        costPerWonCustomerCents: averageCents(marketingSpendCents, wonCustomerCount(withContract)),
      },
      leads: { total: facts.leadCount },
      hero: {
        quotesSentThisMonth: {
          value: facts.quotesSentThisMonth,
          goal: HERO_GOALS.quotesSentThisMonth,
          met: facts.quotesSentThisMonth >= HERO_GOALS.quotesSentThisMonth,
        },
        averageTicketCents: {
          value: averageTicketCents,
          goalCents: HERO_GOALS.averageTicketCents,
          met: meetsGoal(averageTicketCents, HERO_GOALS.averageTicketCents),
        },
        netProfitPerProjectCents: {
          value: netProfitPerProjectCents,
          goalCents: HERO_GOALS.netProfitPerProjectCents,
          met: meetsGoal(netProfitPerProjectCents, HERO_GOALS.netProfitPerProjectCents),
        },
      },
    };
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function netPayments(payments: Array<{ amountCents: number; type: string }>): number {
  return sum(payments.map((payment) => (payment.type === 'REFUND' ? -payment.amountCents : payment.amountCents)));
}

function inPeriod(value: Date, start: Date, end: Date): boolean {
  return value >= start && value < end;
}

function costBreakdown(costs: DashboardCostFact[]): DashboardDto['costs']['breakdown'] {
  const totals = new Map<DashboardCostFact['category'], number>();
  for (const cost of costs) {
    totals.set(cost.category, (totals.get(cost.category) ?? 0) + cost.totalCents);
  }
  return [...totals.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function profitByService(
  projects: DashboardProjectFact[],
  costs: DashboardCostFact[],
  marketing: DashboardMarketingFact[],
): DashboardDto['profitByService'] {
  const costsByProject = totalByProject(costs);
  const marketingByProject = totalByProject(marketing.filter(hasProjectId));
  const byService = new Map<
    ServiceType | null,
    { contractCents: number; costsCents: number; projectCount: number }
  >();

  for (const project of projects) {
    const existing = byService.get(project.serviceType) ?? {
      contractCents: 0,
      costsCents: 0,
      projectCount: 0,
    };
    existing.contractCents += project.contractAmountCents ?? 0;
    existing.costsCents += (costsByProject.get(project.id) ?? 0) + (marketingByProject.get(project.id) ?? 0);
    existing.projectCount += 1;
    byService.set(project.serviceType, existing);
  }

  return [...byService.entries()]
    .map(([serviceType, value]) => ({
      serviceType,
      contractCents: value.contractCents,
      costsCents: value.costsCents,
      profitCents: value.contractCents - value.costsCents,
      projectCount: value.projectCount,
    }))
    .sort((a, b) => b.profitCents - a.profitCents);
}

function totalByProject(rows: Array<{ projectId: string; totalCents?: number; amountCents?: number }>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.projectId, (totals.get(row.projectId) ?? 0) + (row.totalCents ?? row.amountCents ?? 0));
  }
  return totals;
}

function hasProjectId(spend: DashboardMarketingFact): spend is DashboardMarketingFact & { projectId: string } {
  return spend.projectId !== null;
}

function wonCustomerCount(projects: DashboardProjectFact[]): number {
  const customerIds = new Set(projects.flatMap((project) => (project.customerId ? [project.customerId] : [])));
  return customerIds.size > 0 ? customerIds.size : projects.length;
}
