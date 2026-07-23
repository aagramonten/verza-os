import type { PrismaClient } from '@prisma/client';
import type {
  CreateLoginTokenInput,
  CustomerAuthRecord,
  CustomerLoginTokenRepository,
  ExchangeLoginTokenInput,
} from '../application/ports.js';

const customerSelect = {
  id: true,
  companyId: true,
  name: true,
  phone: true,
  email: true,
  municipality: true,
} as const;

export class PrismaCustomerLoginTokenRepository implements CustomerLoginTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateLoginTokenInput): Promise<void> {
    await this.prisma.customerAuthToken.create({
      data: {
        companyId: input.companyId,
        customerId: input.customerId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ipHash: input.ipHash,
      },
    });
  }

  exchange(input: ExchangeLoginTokenInput): Promise<CustomerAuthRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.customerAuthToken.findFirst({
        where: {
          companyId: input.companyId,
          tokenHash: input.loginTokenHash,
          purpose: 'PORTAL_LOGIN',
          usedAt: null,
          expiresAt: { gt: input.now },
        },
        select: { companyId: true, customerId: true, customer: { select: customerSelect } },
      });
      if (!token) return null;

      const consumed = await tx.customerAuthToken.updateMany({
        where: {
          companyId: input.companyId,
          tokenHash: input.loginTokenHash,
          purpose: 'PORTAL_LOGIN',
          usedAt: null,
          expiresAt: { gt: input.now },
        },
        data: { usedAt: input.now },
      });
      if (consumed.count !== 1) return null;

      await tx.customerSession.create({
        data: {
          companyId: token.companyId,
          customerId: token.customerId,
          tokenHash: input.sessionTokenHash,
          expiresAt: input.sessionExpiresAt,
          lastUsedAt: input.now,
          ipHash: input.ipHash,
          userAgent: input.userAgent,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: token.companyId,
          actorType: 'CUSTOMER',
          actorId: token.customerId,
          action: 'customer_auth.login.success',
          entity: 'customer',
          entityId: token.customerId,
          data: { ipHash: input.ipHash },
        },
      });
      return token.customer;
    });
  }
}
