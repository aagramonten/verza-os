import type { PrismaClient } from '@prisma/client';
import type { LeadMediaRepository } from '../application/media-upload.service.js';

/** Tenant-scoped persistence of lead_media rows. */
export class PrismaLeadMediaRepository implements LeadMediaRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  async create(input: {
    leadId: string;
    sessionId: string;
    storageKey: string;
    mime: string;
    sizeBytes: number;
  }): Promise<{ id: string }> {
    const row = await this.prisma.leadMedia.create({
      data: {
        companyId: this.companyId,
        leadId: input.leadId,
        sessionId: input.sessionId,
        kind: 'PHOTO',
        storageKey: input.storageKey,
        mime: input.mime,
        sizeBytes: input.sizeBytes,
        uploadedBy: 'CUSTOMER',
      },
      select: { id: true },
    });
    return row;
  }

  async countPhotos(leadId: string): Promise<number> {
    return this.prisma.leadMedia.count({
      where: { leadId, companyId: this.companyId, kind: 'PHOTO' },
    });
  }
}
