export type CustomerProjectServiceType =
  | 'DESIGN_INSTALLATION'
  | 'LAWN'
  | 'IRRIGATION'
  | 'LIGHTING'
  | 'PLANTING'
  | 'CLEANUP'
  | 'MAINTENANCE'
  | 'OTHER';

export type CustomerProjectStatus =
  'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

/**
 * Intentionally narrow customer-facing project summary.
 * Internal ids, tenant ownership, scope, notes, financials, quotes and audit
 * evidence never cross the portal boundary.
 */
export interface CustomerProjectSummaryDto {
  referenceNumber: string;
  title: string | null;
  serviceType: CustomerProjectServiceType | null;
  status: CustomerProjectStatus;
  contractSignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CustomerProjectListDto {
  items: CustomerProjectSummaryDto[];
}
