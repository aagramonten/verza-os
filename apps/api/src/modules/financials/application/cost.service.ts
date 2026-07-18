import type { CostDto, Page } from './dto.js';
import type {
  Actor,
  AuditRecorder,
  CostRepository,
  ListOptions,
  PartialUndefined,
  ProjectRepository,
} from './ports.js';
import { ResourceNotFoundError } from './errors.js';
import { computeCostTotalCents } from '../domain/money.js';

export interface CreateCostRequest {
  category: CostDto['category'];
  description: string;
  vendor?: string | null | undefined;
  quantity: number;
  unitCostCents: number;
  purchaseDate: Date;
  receiptKey?: string | null | undefined;
  notes?: string | null | undefined;
}

export type UpdateCostRequest = PartialUndefined<CreateCostRequest>;

export interface CostServiceDeps {
  costs: CostRepository;
  projects: ProjectRepository;
  audit: AuditRecorder;
}

/**
 * Project cost entries. The line total is ALWAYS computed server-side from
 * quantity × unit price — the client never supplies it.
 */
export class CostService {
  constructor(private readonly deps: CostServiceDeps) {}

  async create(actor: Actor, projectId: string, input: CreateCostRequest): Promise<CostDto> {
    await this.assertProject(actor.companyId, projectId);
    const totalCents = computeCostTotalCents(input.quantity, input.unitCostCents);
    const cost = await this.deps.costs.create(actor.companyId, projectId, {
      category: input.category,
      description: input.description,
      vendor: input.vendor ?? null,
      quantity: input.quantity,
      unitCostCents: input.unitCostCents,
      totalCents,
      purchaseDate: input.purchaseDate,
      receiptKey: input.receiptKey ?? null,
      notes: input.notes ?? null,
    });
    await this.audit(actor, 'financials.cost.created', cost.id, { projectId, totalCents });
    return cost;
  }

  async list(actor: Actor, projectId: string, options: ListOptions): Promise<Page<CostDto>> {
    await this.assertProject(actor.companyId, projectId);
    return this.deps.costs.list(actor.companyId, projectId, options);
  }

  async update(
    actor: Actor,
    projectId: string,
    costId: string,
    input: UpdateCostRequest,
  ): Promise<CostDto> {
    const existing = await this.deps.costs.findById(actor.companyId, projectId, costId);
    if (!existing) {
      throw new ResourceNotFoundError('Cost');
    }

    // Recompute the total whenever a factor of it changes.
    const quantity = input.quantity ?? existing.quantity;
    const unitCostCents = input.unitCostCents ?? existing.unitCostCents;
    const totalCents = computeCostTotalCents(quantity, unitCostCents);

    const updated = await this.deps.costs.update(actor.companyId, projectId, costId, {
      ...input,
      quantity,
      unitCostCents,
      totalCents,
    });
    if (!updated) {
      throw new ResourceNotFoundError('Cost');
    }
    await this.audit(actor, 'financials.cost.updated', costId, { projectId });
    return updated;
  }

  async remove(actor: Actor, projectId: string, costId: string): Promise<void> {
    const deleted = await this.deps.costs.delete(actor.companyId, projectId, costId);
    if (!deleted) {
      throw new ResourceNotFoundError('Cost');
    }
    await this.audit(actor, 'financials.cost.deleted', costId, { projectId });
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
      entity: 'project_cost',
      entityId,
      data,
    });
  }
}
