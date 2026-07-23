import type { FollowUpStatus, LeadStatus, ServiceType } from '@prisma/client';

/** Tenant-scoped actor derived from a verified access token. */
export interface Actor {
  companyId: string;
  userId: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LeadCustomerDto {
  name: string | null;
  phone: string | null;
  email: string | null;
  municipality: string | null;
}

export interface LeadListItemDto {
  id: string;
  referenceNumber: string;
  status: LeadStatus;
  followUpStatus: FollowUpStatus;
  serviceType: ServiceType | null;
  description: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  customer: LeadCustomerDto | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full lead file for the follow-up view: summary, notes, and scoring aids. */
export interface LeadDetailDto extends LeadListItemDto {
  desiredDate: string | null;
  preferredVisitTime: string | null;
  adminSummary: unknown;
  collectedData: {
    fields: Record<string, unknown>;
    confirmed: string[];
  } | null;
  leadScore: number | null;
  conversionBand: string | null;
  suggestedNextAction: string | null;
  photoCount: number;
}

export interface LeadListOptions {
  limit: number;
  offset: number;
  followUpStatus?: FollowUpStatus;
}

export interface LeadRepository {
  list(companyId: string, options: LeadListOptions): Promise<Page<LeadListItemDto>>;
  findById(companyId: string, id: string): Promise<LeadDetailDto | null>;
  updateFollowUpStatus(
    companyId: string,
    id: string,
    status: FollowUpStatus,
  ): Promise<LeadDetailDto | null>;
}

export interface AuditRecorder {
  record(entry: {
    actorType: 'ADMIN';
    actorId?: string;
    action: string;
    entity: string;
    entityId: string;
    data?: Record<string, unknown>;
  }): Promise<void>;
}
