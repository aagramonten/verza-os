import type { FollowUpStatus } from '@prisma/client';
import { LeadNotFoundError } from './errors.js';
import type {
  Actor,
  AuditRecorder,
  LeadDetailDto,
  LeadListItemDto,
  LeadListOptions,
  LeadRepository,
  Page,
} from './ports.js';

export interface LeadsServiceDeps {
  leads: LeadRepository;
  audit: AuditRecorder;
}

/** Owner/admin lead follow-up. Tenant scope comes from the actor only. */
export class LeadsService {
  constructor(private readonly deps: LeadsServiceDeps) {}

  async list(actor: Actor, options: LeadListOptions): Promise<Page<LeadListItemDto>> {
    return this.deps.leads.list(actor.companyId, options);
  }

  async get(actor: Actor, id: string): Promise<LeadDetailDto> {
    const lead = await this.deps.leads.findById(actor.companyId, id);
    if (!lead) {
      throw new LeadNotFoundError();
    }
    return lead;
  }

  async updateFollowUpStatus(
    actor: Actor,
    id: string,
    status: FollowUpStatus,
  ): Promise<LeadDetailDto> {
    const updated = await this.deps.leads.updateFollowUpStatus(actor.companyId, id, status);
    if (!updated) {
      throw new LeadNotFoundError();
    }
    await this.deps.audit.record({
      actorType: 'ADMIN',
      actorId: actor.userId,
      action: 'leads.follow_up.updated',
      entity: 'lead',
      entityId: id,
      data: { followUpStatus: status },
    });
    return updated;
  }
}
