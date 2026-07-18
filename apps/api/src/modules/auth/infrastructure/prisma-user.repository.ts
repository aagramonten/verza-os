import type { PrismaClient } from '@prisma/client';
import type { UserRecord, UserRepository } from '../application/ports.js';

const SELECT = {
  id: true,
  companyId: true,
  email: true,
  name: true,
  role: true,
  passwordHash: true,
} as const;

/**
 * User reads for authentication. Email is globally unique, so login resolves
 * the tenant from the user row rather than any request-supplied companyId.
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email }, select: SELECT });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SELECT });
  }
}
