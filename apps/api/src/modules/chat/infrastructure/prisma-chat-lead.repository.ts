import { Prisma, type PrismaClient } from '@prisma/client';
import { LEAD_REFERENCE_PREFIX } from '@verza/shared';
import type { ChatLeadRepository } from '../application/ports.js';

const REFERENCE_PAD = 5; // VG-00001
const MAX_ATTEMPTS = 5;

/**
 * Minimal lead access for the chat module: create the DRAFT lead a session
 * hangs off. Reference numbers are per-tenant sequential; the unique
 * constraint on referenceNumber resolves concurrent races via retry.
 */
export class PrismaChatLeadRepository implements ChatLeadRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  async createDraft(): Promise<{ id: string; referenceNumber: string }> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const count = await this.prisma.lead.count({ where: { companyId: this.companyId } });
      const referenceNumber = `${LEAD_REFERENCE_PREFIX}-${String(count + 1 + attempt).padStart(REFERENCE_PAD, '0')}`;
      try {
        const lead = await this.prisma.lead.create({
          data: { companyId: this.companyId, referenceNumber, status: 'DRAFT' },
          select: { id: true, referenceNumber: true },
        });
        return lead;
      } catch (error) {
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isUniqueViolation || attempt === MAX_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    // Unreachable: the loop either returns or rethrows on the last attempt.
    throw new Error('Failed to allocate a lead reference');
  }
}
