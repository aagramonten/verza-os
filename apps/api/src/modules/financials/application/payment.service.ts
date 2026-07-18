import type { Page, PaymentDto } from './dto.js';
import type {
  Actor,
  AuditRecorder,
  CreatePaymentInput,
  ListOptions,
  PaymentRepository,
  ProjectRepository,
  UpdatePaymentInput,
} from './ports.js';
import { ResourceNotFoundError } from './errors.js';

export interface PaymentServiceDeps {
  payments: PaymentRepository;
  projects: ProjectRepository;
  audit: AuditRecorder;
}

/** Payments received against a project. Their sum is Collected Revenue. */
export class PaymentService {
  constructor(private readonly deps: PaymentServiceDeps) {}

  async create(actor: Actor, projectId: string, input: CreatePaymentInput): Promise<PaymentDto> {
    await this.assertProject(actor.companyId, projectId);
    const payment = await this.deps.payments.create(actor.companyId, projectId, input);
    await this.audit(actor, 'financials.payment.created', payment.id, {
      projectId,
      amountCents: input.amountCents,
    });
    return payment;
  }

  async list(actor: Actor, projectId: string, options: ListOptions): Promise<Page<PaymentDto>> {
    await this.assertProject(actor.companyId, projectId);
    return this.deps.payments.list(actor.companyId, projectId, options);
  }

  async update(
    actor: Actor,
    projectId: string,
    paymentId: string,
    input: UpdatePaymentInput,
  ): Promise<PaymentDto> {
    const updated = await this.deps.payments.update(actor.companyId, projectId, paymentId, input);
    if (!updated) {
      throw new ResourceNotFoundError('Payment');
    }
    await this.audit(actor, 'financials.payment.updated', paymentId, { projectId });
    return updated;
  }

  async remove(actor: Actor, projectId: string, paymentId: string): Promise<void> {
    const deleted = await this.deps.payments.delete(actor.companyId, projectId, paymentId);
    if (!deleted) {
      throw new ResourceNotFoundError('Payment');
    }
    await this.audit(actor, 'financials.payment.deleted', paymentId, { projectId });
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
      entity: 'payment',
      entityId,
      data,
    });
  }
}
