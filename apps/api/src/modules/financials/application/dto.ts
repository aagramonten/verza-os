import type {
  CostCategory,
  MarketingChannel,
  PaymentMethod,
  PaymentType,
  ProjectStatus,
  ServiceType,
} from '@prisma/client';

/**
 * Client-facing shapes. Money is always integer cents plus an explicit
 * currency. Dates serialize to ISO strings via Express' JSON encoder.
 * These DTOs are the ONLY financial shapes that leave the process.
 */

export interface ProjectDto {
  id: string;
  companyId: string;
  referenceNumber: string;
  title: string | null;
  serviceType: ServiceType | null;
  status: ProjectStatus;
  scope: string | null;
  notes: string | null;
  currency: string;
  contractAmountCents: number | null;
  contractSignedAt: Date | null;
  wonAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  leadId: string | null;
  customerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostDto {
  id: string;
  projectId: string;
  category: CostCategory;
  description: string;
  vendor: string | null;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
  currency: string;
  purchaseDate: Date;
  receiptKey: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingSpendDto {
  id: string;
  channel: MarketingChannel;
  description: string | null;
  amountCents: number;
  currency: string;
  spentAt: Date;
  projectId: string | null;
  campaignRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentDto {
  id: string;
  projectId: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  type: PaymentType;
  reference: string | null;
  receivedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
