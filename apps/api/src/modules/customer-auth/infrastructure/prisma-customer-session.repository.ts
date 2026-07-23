import type { PrismaClient } from '@prisma/client';
import type { CustomerSessionRepository, StoredCustomerSession } from '../application/ports.js';

export class PrismaCustomerSessionRepository implements CustomerSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByHash(companyId: string, tokenHash: string): Promise<StoredCustomerSession | null> {
    return this.prisma.customerSession.findFirst({
      where: { companyId, tokenHash },
      select: {
        id: true,
        companyId: true,
        customerId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  async touch(companyId: string, id: string, at: Date): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { id, companyId, revokedAt: null },
      data: { lastUsedAt: at },
    });
  }

  async revoke(companyId: string, tokenHash: string, at: Date): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { companyId, tokenHash, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
