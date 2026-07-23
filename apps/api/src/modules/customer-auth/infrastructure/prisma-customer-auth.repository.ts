import type { PrismaClient } from '@prisma/client';
import type { CustomerAuthRecord, CustomerAuthRepository } from '../application/ports.js';

const customerSelect = {
  id: true,
  companyId: true,
  name: true,
  phone: true,
  email: true,
  municipality: true,
} as const;

export class PrismaCustomerAuthRepository implements CustomerAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(companyId: string, email: string): Promise<CustomerAuthRecord | null> {
    const matches = await this.prisma.customer.findMany({
      where: { companyId, email },
      select: customerSelect,
      take: 2,
    });
    // Email is not yet a canonical CRM identity. Refuse ambiguous matches
    // instead of authenticating an arbitrary customer record.
    return matches.length === 1 ? matches[0]! : null;
  }

  findByPhone(companyId: string, phone: string): Promise<CustomerAuthRecord | null> {
    return this.prisma.customer.findFirst({
      where: { companyId, phone },
      select: customerSelect,
    });
  }

  findById(companyId: string, customerId: string): Promise<CustomerAuthRecord | null> {
    return this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: customerSelect,
    });
  }
}
