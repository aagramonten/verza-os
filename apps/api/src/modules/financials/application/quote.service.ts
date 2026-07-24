import type { OfficialQuoteDto, Page } from './dto.js';
import {
  InvalidInputError,
  QuoteConflictError,
  QuotePermissionError,
  ResourceNotFoundError,
} from './errors.js';
import type {
  Actor,
  Clock,
  CreateOfficialQuoteInput,
  ListOptions,
  OfficialQuoteRepository,
  OfficialQuoteSnapshot,
  OfficialQuoteTransitionResult,
} from './ports.js';
import {
  priceQuote,
  QuoteDomainError,
  transitionQuote,
  type QuoteWorkflowAction,
} from '../domain/quote.js';

export interface QuoteServiceDeps {
  quotes: OfficialQuoteRepository;
  clock: Clock;
}

/**
 * Human-admin quote use cases. Pricing and state decisions live here/domain;
 * persistence only performs tenant-scoped compare-and-swap mutations.
 */
export class QuoteService {
  constructor(private readonly deps: QuoteServiceDeps) {}

  async createDraft(
    actor: Actor,
    projectId: string,
    input: CreateOfficialQuoteInput,
  ): Promise<OfficialQuoteDto> {
    const snapshot = this.priceSnapshot(input, this.deps.clock.now());
    const result = await this.deps.quotes.createInitialDraft({
      companyId: actor.companyId,
      projectId,
      actorId: actor.userId,
      actorRole: actor.role,
      snapshot,
    });

    if (result.kind === 'project-not-found') {
      throw new ResourceNotFoundError('Project');
    }
    if (result.kind === 'actor-not-allowed') {
      throw new QuotePermissionError();
    }
    if (result.kind === 'already-exists') {
      throw new QuoteConflictError(
        'This project already has a quote; use requote to create a new version',
      );
    }
    return result.quote;
  }

  async list(
    actor: Actor,
    projectId: string,
    options: ListOptions,
  ): Promise<Page<OfficialQuoteDto>> {
    const page = await this.deps.quotes.list(actor.companyId, projectId, options);
    if (!page) {
      throw new ResourceNotFoundError('Project');
    }
    return page;
  }

  async get(actor: Actor, projectId: string, quoteId: string): Promise<OfficialQuoteDto> {
    return this.requireQuote(actor, projectId, quoteId);
  }

  async submit(actor: Actor, projectId: string, quoteId: string): Promise<OfficialQuoteDto> {
    return this.performTransition(actor, projectId, quoteId, 'SUBMIT_FOR_APPROVAL');
  }

  async approve(actor: Actor, projectId: string, quoteId: string): Promise<OfficialQuoteDto> {
    return this.performTransition(actor, projectId, quoteId, 'APPROVE');
  }

  async markSent(actor: Actor, projectId: string, quoteId: string): Promise<OfficialQuoteDto> {
    return this.performTransition(actor, projectId, quoteId, 'SEND');
  }

  async requote(
    actor: Actor,
    projectId: string,
    quoteId: string,
    input: CreateOfficialQuoteInput,
  ): Promise<OfficialQuoteDto> {
    const current = await this.requireQuote(actor, projectId, quoteId);
    this.nextStatus(current.status, 'REQUOTE', actor);

    const now = this.deps.clock.now();
    const snapshot = this.priceSnapshot(input, now);
    const result = await this.deps.quotes.requote({
      companyId: actor.companyId,
      projectId,
      quoteId,
      actorId: actor.userId,
      actorRole: actor.role,
      at: now,
      snapshot,
    });

    if (result.kind === 'not-found') {
      throw new ResourceNotFoundError('Official quote');
    }
    if (result.kind === 'actor-not-allowed') {
      throw new QuotePermissionError();
    }
    if (result.kind === 'conflict') {
      throw new QuoteConflictError(
        `Cannot requote an official quote in ${result.currentStatus} status`,
      );
    }
    return result.quote;
  }

  private async performTransition(
    actor: Actor,
    projectId: string,
    quoteId: string,
    action: Exclude<QuoteWorkflowAction, 'REQUOTE'>,
  ): Promise<OfficialQuoteDto> {
    const current = await this.requireQuote(actor, projectId, quoteId);
    const expectedTarget = targetFor(action);

    // Replays are idempotent, but permission is still checked for the
    // business-critical approve/send actions before returning any result.
    const fromStatus = current.status === expectedTarget ? sourceFor(action) : current.status;
    const nextStatus = this.nextStatus(fromStatus, action, actor);
    const result = await this.deps.quotes.transition({
      companyId: actor.companyId,
      projectId,
      quoteId,
      actorId: actor.userId,
      actorRole: actor.role,
      action,
      fromStatus,
      toStatus: nextStatus,
      at: this.deps.clock.now(),
    });
    return this.resolveTransition(result, action);
  }

  private resolveTransition(
    result: OfficialQuoteTransitionResult,
    action: Exclude<QuoteWorkflowAction, 'REQUOTE'>,
  ): OfficialQuoteDto {
    if (result.kind === 'updated' || result.kind === 'unchanged') {
      return result.quote;
    }
    if (result.kind === 'not-found') {
      throw new ResourceNotFoundError('Official quote');
    }
    if (result.kind === 'actor-not-allowed') {
      throw new QuotePermissionError();
    }
    if (result.kind === 'expired') {
      throw new QuoteConflictError('The official quote has expired');
    }
    if (result.kind === 'invalid-snapshot') {
      throw new QuoteConflictError('The official quote snapshot is incomplete or inconsistent');
    }
    throw new QuoteConflictError(
      `Cannot ${action.toLowerCase()} an official quote in ${result.currentStatus} status`,
    );
  }

  private async requireQuote(
    actor: Actor,
    projectId: string,
    quoteId: string,
  ): Promise<OfficialQuoteDto> {
    const quote = await this.deps.quotes.findById(actor.companyId, projectId, quoteId);
    if (!quote) {
      throw new ResourceNotFoundError('Official quote');
    }
    return quote;
  }

  private priceSnapshot(input: CreateOfficialQuoteInput, now: Date): OfficialQuoteSnapshot {
    if (!Number.isFinite(input.validUntil.getTime()) || input.validUntil <= now) {
      throw new InvalidInputError('validUntil must be a future date');
    }
    const priced = priceQuote({
      lineItems: input.lineItems,
      taxRateBps: input.taxRateBps,
    });
    return {
      ...priced,
      validUntil: input.validUntil,
      notes: input.notes ?? null,
    };
  }

  private nextStatus(
    status: OfficialQuoteDto['status'],
    action: QuoteWorkflowAction,
    actor: Actor,
  ): OfficialQuoteDto['status'] {
    try {
      return transitionQuote(status, action, {
        kind: actor.kind,
        role: actor.role,
        actorId: actor.userId,
      });
    } catch (error) {
      if (error instanceof QuoteDomainError && error.code === 'HUMAN_ACTOR_REQUIRED') {
        throw new QuotePermissionError(error.message);
      }
      throw error;
    }
  }
}

function targetFor(action: Exclude<QuoteWorkflowAction, 'REQUOTE'>): OfficialQuoteDto['status'] {
  if (action === 'SUBMIT_FOR_APPROVAL') return 'PENDING_APPROVAL';
  if (action === 'APPROVE') return 'APPROVED';
  return 'SENT';
}

function sourceFor(action: Exclude<QuoteWorkflowAction, 'REQUOTE'>): OfficialQuoteDto['status'] {
  if (action === 'SUBMIT_FOR_APPROVAL') return 'DRAFT';
  if (action === 'APPROVE') return 'PENDING_APPROVAL';
  return 'APPROVED';
}
