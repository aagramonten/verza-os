import type { PrismaClient } from '@prisma/client';
import type {
  CustomerProjectRepository,
  CustomerProjectSummaryRecord,
} from '../application/ports.js';

export class PrismaCustomerProjectRepository implements CustomerProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForCustomer(
    companyId: string,
    customerId: string,
  ): Promise<CustomerProjectSummaryRecord[]> {
    return this.prisma.project.findMany({
      where: {
        companyId,
        customerId,
      },
      select: {
        referenceNumber: true,
        title: true,
        serviceType: true,
        status: true,
        contractSignedAt: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
