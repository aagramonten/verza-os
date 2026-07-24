import type {
  CostCategory,
  MarketingChannel,
  PaymentType,
  PaymentMethod,
  ProjectStatus,
  QuoteStatus,
  ServiceType,
  UserRole,
} from '@prisma/client';
import type {
  CostDto,
  MarketingSpendDto,
  OfficialQuoteDto,
  OfficialQuoteLineItemDto,
  PaymentDto,
  Page,
  ProjectDto,
} from './dto.js';
import type { QuoteWorkflowAction } from '../domain/quote.js';

export interface Clock {
  now(): Date;
}

/** The authenticated caller, derived from the verified access token. */
export interface Actor {
  companyId: string;
  userId: string;
  role: UserRole;
  kind: 'HUMAN';
}

/** Append-only audit port; satisfied by the shared AuditLogService. */
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

export interface ListOptions {
  limit: number;
  offset: number;
}

/**
 * Partial where present properties may also be explicitly `undefined` — the
 * shape Zod produces for optional fields under exactOptionalPropertyTypes.
 */
export type PartialUndefined<T> = { [K in keyof T]?: T[K] | undefined };

// ── Projects ─────────────────────────────────────────────────────────

export interface CreateProjectInput {
  title?: string | null | undefined;
  serviceType?: ServiceType | null | undefined;
  status?: ProjectStatus | undefined;
  scope?: string | null | undefined;
  notes?: string | null | undefined;
  contractAmountCents?: number | null | undefined;
  contractSignedAt?: Date | null | undefined;
  wonAt?: Date | null | undefined;
  startedAt?: Date | null | undefined;
  completedAt?: Date | null | undefined;
  leadId?: string | null | undefined;
  customerId?: string | null | undefined;
}

export type UpdateProjectInput = PartialUndefined<CreateProjectInput>;

export interface ProjectRepository {
  create(companyId: string, input: CreateProjectInput): Promise<ProjectDto>;
  findById(companyId: string, id: string): Promise<ProjectDto | null>;
  list(companyId: string, options: ListOptions): Promise<Page<ProjectDto>>;
  update(companyId: string, id: string, input: UpdateProjectInput): Promise<ProjectDto | null>;
}

// ── Official quotes ─────────────────────────────────────────────────

export interface CreateOfficialQuoteInput {
  lineItems: Array<{
    description: string;
    quantityMilli: number;
    unitPriceCents: number;
  }>;
  taxRateBps: number;
  validUntil: Date;
  notes?: string | null | undefined;
}

/** Fully server-priced immutable commercial snapshot. */
export interface OfficialQuoteSnapshot {
  lineItems: OfficialQuoteLineItemDto[];
  subtotalCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  validUntil: Date;
  notes: string | null;
}

export type CreateOfficialQuoteResult =
  | { kind: 'created'; quote: OfficialQuoteDto }
  | { kind: 'project-not-found' }
  | { kind: 'actor-not-allowed' }
  | { kind: 'already-exists' };

export type OfficialQuoteTransitionResult =
  | { kind: 'updated'; quote: OfficialQuoteDto }
  | { kind: 'unchanged'; quote: OfficialQuoteDto }
  | { kind: 'not-found' }
  | { kind: 'actor-not-allowed' }
  | { kind: 'expired' }
  | { kind: 'invalid-snapshot' }
  | { kind: 'conflict'; currentStatus: QuoteStatus };

export type RequoteResult =
  | { kind: 'created'; quote: OfficialQuoteDto }
  | { kind: 'not-found' }
  | { kind: 'actor-not-allowed' }
  | { kind: 'conflict'; currentStatus: QuoteStatus };

export interface OfficialQuoteTransitionCommand {
  companyId: string;
  projectId: string;
  quoteId: string;
  actorId: string;
  actorRole: UserRole;
  action: Exclude<QuoteWorkflowAction, 'REQUOTE'>;
  fromStatus: QuoteStatus;
  toStatus: QuoteStatus;
  at: Date;
}

export interface OfficialQuoteRepository {
  createInitialDraft(input: {
    companyId: string;
    projectId: string;
    actorId: string;
    actorRole: UserRole;
    snapshot: OfficialQuoteSnapshot;
  }): Promise<CreateOfficialQuoteResult>;
  findById(companyId: string, projectId: string, quoteId: string): Promise<OfficialQuoteDto | null>;
  list(
    companyId: string,
    projectId: string,
    options: ListOptions,
  ): Promise<Page<OfficialQuoteDto> | null>;
  transition(input: OfficialQuoteTransitionCommand): Promise<OfficialQuoteTransitionResult>;
  requote(input: {
    companyId: string;
    projectId: string;
    quoteId: string;
    actorId: string;
    actorRole: UserRole;
    at: Date;
    snapshot: OfficialQuoteSnapshot;
  }): Promise<RequoteResult>;
}

// ── Costs ────────────────────────────────────────────────────────────

export interface CreateCostInput {
  category: CostCategory;
  description: string;
  vendor?: string | null | undefined;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
  purchaseDate: Date;
  receiptKey?: string | null | undefined;
  notes?: string | null | undefined;
}

export type UpdateCostInput = PartialUndefined<CreateCostInput>;

export interface CostRepository {
  create(companyId: string, projectId: string, input: CreateCostInput): Promise<CostDto>;
  list(companyId: string, projectId: string, options: ListOptions): Promise<Page<CostDto>>;
  findById(companyId: string, projectId: string, id: string): Promise<CostDto | null>;
  update(
    companyId: string,
    projectId: string,
    id: string,
    input: UpdateCostInput,
  ): Promise<CostDto | null>;
  delete(companyId: string, projectId: string, id: string): Promise<boolean>;
}

// ── Marketing spend ──────────────────────────────────────────────────

export interface CreateMarketingSpendInput {
  channel: MarketingChannel;
  description?: string | null | undefined;
  amountCents: number;
  spentAt: Date;
  projectId?: string | null | undefined;
  campaignRef?: string | null | undefined;
}

export type UpdateMarketingSpendInput = PartialUndefined<CreateMarketingSpendInput>;

export interface MarketingSpendListFilter extends ListOptions {
  projectId?: string;
  channel?: MarketingChannel;
}

export interface MarketingSpendRepository {
  create(companyId: string, input: CreateMarketingSpendInput): Promise<MarketingSpendDto>;
  list(companyId: string, filter: MarketingSpendListFilter): Promise<Page<MarketingSpendDto>>;
  findById(companyId: string, id: string): Promise<MarketingSpendDto | null>;
  update(
    companyId: string,
    id: string,
    input: UpdateMarketingSpendInput,
  ): Promise<MarketingSpendDto | null>;
  delete(companyId: string, id: string): Promise<boolean>;
}

// ── Payments ─────────────────────────────────────────────────────────

export interface CreatePaymentInput {
  amountCents: number;
  method: PaymentMethod;
  type: PaymentType;
  reference?: string | null | undefined;
  receivedAt: Date;
  notes?: string | null | undefined;
}

export type UpdatePaymentInput = PartialUndefined<CreatePaymentInput>;

export interface PaymentRepository {
  create(companyId: string, projectId: string, input: CreatePaymentInput): Promise<PaymentDto>;
  list(companyId: string, projectId: string, options: ListOptions): Promise<Page<PaymentDto>>;
  findById(companyId: string, projectId: string, id: string): Promise<PaymentDto | null>;
  update(
    companyId: string,
    projectId: string,
    id: string,
    input: UpdatePaymentInput,
  ): Promise<PaymentDto | null>;
  delete(companyId: string, projectId: string, id: string): Promise<boolean>;
}

// ── Dashboard read model ─────────────────────────────────────────────

export interface DashboardPeriod {
  start: Date;
  end: Date;
}

export interface DashboardProjectFact {
  id: string;
  status: ProjectStatus;
  serviceType: ServiceType | null;
  customerId: string | null;
  contractAmountCents: number | null;
  contractSignedAt: Date | null;
}

export interface DashboardCostFact {
  projectId: string;
  category: CostCategory;
  totalCents: number;
  purchaseDate: Date;
}

export interface DashboardMarketingFact {
  projectId: string | null;
  amountCents: number;
  spentAt: Date;
}

export interface DashboardPaymentFact {
  amountCents: number;
  type: PaymentType;
  receivedAt: Date;
}

export interface DashboardQuoteFact {
  projectId: string;
  totalCents: number;
  version: number;
  sentAt: Date | null;
}

export interface DashboardFacts {
  projects: DashboardProjectFact[];
  projectStatusCounts: Array<{ status: ProjectStatus; count: number }>;
  costs: DashboardCostFact[];
  marketing: DashboardMarketingFact[];
  payments: DashboardPaymentFact[];
  latestActiveQuotes: DashboardQuoteFact[];
  quotesSentThisMonth: number;
  leadCount: number;
}

export interface DashboardRepository {
  load(companyId: string, period: DashboardPeriod): Promise<DashboardFacts>;
}
