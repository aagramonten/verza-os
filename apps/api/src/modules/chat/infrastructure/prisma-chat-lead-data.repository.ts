import type { Prisma, PrismaClient, PropertyType, ServiceType } from '@prisma/client';
import { emptyCollected, type CollectedProjectState } from '../application/collected-project.js';
import type { ChatLeadDataRepository, LeadMirror } from '../application/ports.js';
import type { ConfirmationSummary } from '../application/summary.js';

/**
 * Tenant-scoped access to a lead's conversational data. `collectedData` is the
 * authoritative merge store; `applyMirror` best-effort projects it onto typed
 * columns and the customer row and must never fail a turn.
 */
export class PrismaChatLeadDataRepository implements ChatLeadDataRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  async loadCollected(leadId: string): Promise<CollectedProjectState> {
    const row = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId: this.companyId },
      select: { collectedData: true },
    });
    return parseCollected(row?.collectedData ?? null);
  }

  async saveCollected(leadId: string, state: CollectedProjectState): Promise<void> {
    await this.prisma.lead.updateMany({
      where: { id: leadId, companyId: this.companyId },
      data: {
        collectedData: state as unknown as Prisma.InputJsonValue,
        status: 'COLLECTING',
      },
    });
  }

  async applyMirror(leadId: string, mirror: LeadMirror): Promise<void> {
    try {
      // Guarded assignment: undefined never reaches Prisma's exact-optional inputs.
      const leadUpdate: Prisma.LeadUpdateManyMutationInput = {};
      if (mirror.serviceType !== undefined) {
        leadUpdate.serviceType = mirror.serviceType as ServiceType;
      }
      if (mirror.description !== undefined) leadUpdate.description = mirror.description;
      if (mirror.requiresRemoval !== undefined) leadUpdate.requiresRemoval = mirror.requiresRemoval;
      if (mirror.hasIrrigation !== undefined) leadUpdate.hasIrrigation = mirror.hasIrrigation;
      if (mirror.budgetMinCents !== undefined) leadUpdate.budgetMinCents = mirror.budgetMinCents;
      if (mirror.budgetMaxCents !== undefined) leadUpdate.budgetMaxCents = mirror.budgetMaxCents;
      if (mirror.desiredDate !== undefined) leadUpdate.desiredDate = toDate(mirror.desiredDate);
      if (mirror.preferredVisitTime !== undefined) {
        leadUpdate.preferredVisitTime = mirror.preferredVisitTime;
      }

      if (Object.keys(leadUpdate).length > 0) {
        await this.prisma.lead.updateMany({
          where: { id: leadId, companyId: this.companyId },
          data: leadUpdate,
        });
      }

      const phone = mirror.customer.phone;
      if (phone !== undefined) {
        const update: Prisma.CustomerUpdateInput = {};
        if (mirror.customer.name !== undefined) update.name = mirror.customer.name;
        if (mirror.customer.email !== undefined) update.email = mirror.customer.email;
        if (mirror.customer.municipality !== undefined) {
          update.municipality = mirror.customer.municipality;
        }
        if (mirror.customer.propertyType !== undefined) {
          update.propertyType = mirror.customer.propertyType as PropertyType;
        }
        const customer = await this.prisma.customer.upsert({
          where: { companyId_phone: { companyId: this.companyId, phone } },
          update,
          create: {
            companyId: this.companyId,
            phone,
            name: mirror.customer.name ?? null,
            email: mirror.customer.email ?? null,
            municipality: mirror.customer.municipality ?? null,
            propertyType: (mirror.customer.propertyType ?? null) as PropertyType | null,
          },
        });
        await this.prisma.lead.updateMany({
          where: { id: leadId, companyId: this.companyId },
          data: { customerId: customer.id },
        });
      }
    } catch {
      // Mirror is a convenience projection; the collected store is authoritative.
    }
  }

  async countPhotos(leadId: string): Promise<number> {
    return this.prisma.leadMedia.count({
      where: { leadId, companyId: this.companyId, kind: 'PHOTO' },
    });
  }

  async markReadyForReview(leadId: string, summary: ConfirmationSummary, at: Date): Promise<void> {
    await this.prisma.lead.updateMany({
      where: { id: leadId, companyId: this.companyId },
      data: {
        status: 'READY_FOR_REVIEW',
        confirmedAt: at,
        adminSummary: summary as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

function parseCollected(value: Prisma.JsonValue | null): CollectedProjectState {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return emptyCollected();
  }
  const record = value as Record<string, unknown>;
  const fields =
    typeof record['fields'] === 'object' && record['fields'] !== null
      ? (record['fields'] as Record<string, unknown>)
      : {};
  const confirmed = Array.isArray(record['confirmed'])
    ? (record['confirmed'] as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  return { fields, confirmed };
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
