import type { CostCategory, ProjectStatus, ServiceType } from '@prisma/client';

/**
 * Owner financial dashboard. Every money value is integer cents in `currency`.
 * Percentages are numbers (e.g. 42.5 = 42.5%) or null when the denominator is
 * zero. Nothing here is stored — it is recomputed deterministically on read
 * from projects, costs, marketing, payments, quotes, and leads.
 */
export interface DashboardDto {
  currency: string;
  period: { label: string; start: Date; end: Date };

  revenue: {
    quotedCents: number; // latest active quote per project
    contractCents: number; // expected revenue (Σ contract amounts)
    collectedCents: number; // Σ payments, net of refunds
    outstandingCents: number; // contract − collected
  };

  thisMonth: {
    contractSignedCents: number; // work sold this month
    collectedCents: number; // cash collected this month
    costsCents: number; // project costs + marketing spent this month
    quotesSent: number;
  };

  costs: {
    projectCostsCents: number;
    marketingSpendCents: number;
    totalCents: number;
    breakdown: Array<{ category: CostCategory; amountCents: number }>;
  };

  profit: {
    grossCents: number; // contract − project costs
    netCents: number; // gross − marketing
    grossMarginPct: number | null;
    netMarginPct: number | null;
    averagePerProjectCents: number | null;
    roiPct: number | null; // net / total costs
  };

  averages: {
    ticketCents: number | null; // contract / projects with a contract
  };

  projects: {
    total: number; // active (non-cancelled)
    withContract: number;
    byStatus: Array<{ status: ProjectStatus; count: number }>;
  };

  /** Sorted by profit descending — the head is the best-performing service. */
  profitByService: Array<{
    serviceType: ServiceType | null;
    contractCents: number;
    costsCents: number;
    profitCents: number;
    projectCount: number;
  }>;

  marketing: {
    totalCents: number;
    costPerLeadCents: number | null;
    costPerWonCustomerCents: number | null;
  };

  leads: { total: number };

  /** The three headline metrics from the owner's dashboard spec, with goals. */
  hero: {
    quotesSentThisMonth: { value: number; goal: number; met: boolean };
    averageTicketCents: { value: number | null; goalCents: number; met: boolean };
    netProfitPerProjectCents: { value: number | null; goalCents: number; met: boolean };
  };
}
