import type { CustomerProjectServiceType, CustomerProjectStatus } from './dto.js';

export interface CustomerProjectSummaryRecord {
  referenceNumber: string;
  title: string | null;
  serviceType: CustomerProjectServiceType | null;
  status: CustomerProjectStatus;
  contractSignedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface CustomerProjectRepository {
  listForCustomer(companyId: string, customerId: string): Promise<CustomerProjectSummaryRecord[]>;
}
