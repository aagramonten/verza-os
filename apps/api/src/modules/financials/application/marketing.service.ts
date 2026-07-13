import type { MarketingSpendDto, Page } from './dto.js';
import type {
  Actor,
  AuditRecorder,
  CreateMarketingSpendInput,
  MarketingSpendListFilter,
  MarketingSpendRepository,
  ProjectRepository,
  UpdateMarketingSpendInput,
} from './ports.js';
import { ResourceNotFoundError } from './errors.js';

export interface MarketingServiceDeps {
  marketing: MarketingSpendRepository;
  projects: ProjectRepository;
  audit: AuditRecorder;
}

/**
 * Advertising spend. Tracked at the channel level and optionally allocated to
 * a project; when a projectId is given it must belong to the caller's tenant.
 */
export class MarketingService {
  constructor(private readonly deps: MarketingServiceDeps) {}

  async create(actor: Actor, input: CreateMarketingSpendInput): Promise<MarketingSpendDto> {
    if (input.projectId) {
      await this.assertProject(actor.companyId, input.projectId);
    }
    const spend = await this.deps.marketing.create(actor.companyId, input);
    await this.audit(actor, 'financials.marketing.created', spend.id, {
      amountCents: input.amountCents,
      projectId: input.projectId ?? null,
    });
    return spend;
  }

  async list(actor: Actor, filter: MarketingSpendListFilter): Promise<Page<MarketingSpendDto>> {
    return this.deps.marketing.list(actor.companyId, filter);
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateMarketingSpendInput,
  ): Promise<MarketingSpendDto> {
    if (input.projectId) {
      await this.assertProject(actor.companyId, input.projectId);
    }
    const updated = await this.deps.marketing.update(actor.companyId, id, input);
    if (!updated) {
      throw new ResourceNotFoundError('MarketingSpend');
    }
    await this.audit(actor, 'financials.marketing.updated', id, {});
    return updated;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const deleted = await this.deps.marketing.delete(actor.companyId, id);
    if (!deleted) {
      throw new ResourceNotFoundError('MarketingSpend');
    }
    await this.audit(actor, 'financials.marketing.deleted', id, {});
  }

  private async assertProject(companyId: string, projectId: string): Promise<void> {
    const project = await this.deps.projects.findById(companyId, projectId);
    if (!project) {
      throw new ResourceNotFoundError('Project');
    }
  }

  private audit(
    actor: Actor,
    action: string,
    entityId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    return this.deps.audit.record({
      actorType: 'ADMIN',
      actorId: actor.userId,
      action,
      entity: 'marketing_spend',
      entityId,
      data,
    });
  }
}
