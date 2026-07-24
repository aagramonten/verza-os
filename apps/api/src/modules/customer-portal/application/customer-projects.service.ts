import type { CustomerAuthContext } from '../../customer-auth/index.js';
import type { CustomerProjectListDto, CustomerProjectSummaryDto } from './dto.js';
import type { CustomerProjectRepository, CustomerProjectSummaryRecord } from './ports.js';

export class CustomerProjectsService {
  constructor(private readonly projects: CustomerProjectRepository) {}

  async list(context: CustomerAuthContext): Promise<CustomerProjectListDto> {
    const projects = await this.projects.listForCustomer(context.companyId, context.customerId);
    return { items: projects.map(toDto) };
  }
}

function toDto(project: CustomerProjectSummaryRecord): CustomerProjectSummaryDto {
  return {
    referenceNumber: project.referenceNumber,
    title: project.title,
    serviceType: project.serviceType,
    status: project.status,
    contractSignedAt: toIso(project.contractSignedAt),
    startedAt: toIso(project.startedAt),
    completedAt: toIso(project.completedAt),
  };
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}
