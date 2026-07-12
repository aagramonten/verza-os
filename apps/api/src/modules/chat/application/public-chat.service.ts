import type { ChatSessionState } from '@verza/shared';
import type { AuditLogService } from '../../../shared/audit/audit-log.service.js';
import { sanitizeChatMessage } from '../../../shared/text/sanitize.js';
import type { ChatSession } from '../domain/chat-session.js';
import {
  ChatSessionNotFoundError,
  ConfirmationNotAvailableError,
  InvalidResumeTokenError,
  SessionClosedError,
} from '../domain/errors.js';
import { chatStateMachine } from '../domain/state-machine.js';
import { confirmAllPresent } from './merge-policy.js';
import { buildSummary, type ConfirmationSummary } from './summary.js';
import type {
  PublicMessagesCreatedDto,
  PublicSessionCreatedDto,
  PublicSessionDto,
  PublicStatusDto,
} from './dto.js';
import { toPublicMessage, toPublicSession } from './dto.js';
import type {
  ChatLeadDataRepository,
  ChatLeadRepository,
  ChatMessageRepository,
  ChatSessionRepository,
  Clock,
  ConversationEngine,
} from './ports.js';
import type { ResumeTokenService } from './resume-token.service.js';
import {
  QUICK_ACTION_MESSAGES,
  type QuickActionEvent,
} from './quick-action.js';
import type {
  MediaUploadService,
  UploadedFile,
} from '../../media/application/media-upload.service.js';

export interface PublicChatServiceDeps {
  sessions: ChatSessionRepository;
  messages: ChatMessageRepository;
  leads: ChatLeadRepository;
  leadData: ChatLeadDataRepository;
  tokens: ResumeTokenService;
  engine: ConversationEngine;
  media: MediaUploadService;
  audit: AuditLogService;
  clock: Clock;
  resumeTokenTtlDays: number;
}

const CONFIRM_CLOSING =
  'Excelente. Ya recibimos la información de tu proyecto. El equipo de Verza Garden revisará las ' +
  'fotos y los detalles para coordinar el próximo paso.';

const CORRECTION_PROMPT = 'Claro. Dime qué te gustaría ajustar y lo actualizo.';

/**
 * Application service for the public chat endpoints. Controllers delegate here
 * and contain no business logic. The conversation engine produces the reply
 * and a target phase; this service is the sole authority that walks the state
 * machine (never skipping) and persists the assistant message.
 */
export class PublicChatService {
  constructor(private readonly deps: PublicChatServiceDeps) {}

  async createSession(context: {
    ipHash: string;
    userAgent: string | null;
  }): Promise<PublicSessionCreatedDto> {
    const { sessions, leads, tokens, audit, clock, resumeTokenTtlDays } = this.deps;

    const lead = await leads.createDraft();
    const { rawToken, tokenHash } = tokens.generate();
    const now = clock.now();
    const expiresAt = new Date(now.getTime() + resumeTokenTtlDays * 24 * 60 * 60 * 1000);

    const session = await sessions.create({
      leadId: lead.id,
      leadReference: lead.referenceNumber,
      resumeTokenHash: tokenHash,
      expiresAt,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
    });

    await audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.session.created',
      entity: 'chat_session',
      entityId: session.id,
      data: { leadReference: lead.referenceNumber, state: session.state },
    });

    return {
      sessionId: session.id,
      leadReference: session.leadReference,
      state: session.state,
      resumeToken: rawToken,
      createdAt: session.createdAt.toISOString(),
    };
  }

  async appendCustomerMessage(
    sessionId: string,
    rawToken: string,
    rawMessage: string,
  ): Promise<PublicMessagesCreatedDto> {
    return this.processCustomerTurn(sessionId, rawToken, rawMessage, null);
  }

  async appendQuickAction(
    sessionId: string,
    rawToken: string,
    event: QuickActionEvent,
  ): Promise<PublicMessagesCreatedDto> {
    return this.processCustomerTurn(sessionId, rawToken, QUICK_ACTION_MESSAGES[event], event);
  }

  private async processCustomerTurn(
    sessionId: string,
    rawToken: string,
    rawMessage: string,
    quickActionEvent: QuickActionEvent | null,
  ): Promise<PublicMessagesCreatedDto> {
    const { messages, engine, audit } = this.deps;
    const session = await this.authorize(sessionId, rawToken);

    if (!chatStateMachine.isActive(session.state)) {
      throw new SessionClosedError(session.id);
    }

    const content = sanitizeChatMessage(rawMessage);
    const customerMessage = await messages.append(session.id, 'CUSTOMER', content);
    await audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.message.customer_created',
      entity: 'chat_message',
      entityId: customerMessage.id,
      data: { sessionId: session.id, length: content.length, quickActionEvent },
    });

    const history = await messages.listAscending(session.id);
    const photoCount = await this.deps.leadData.countPhotos(session.leadId);

    const turn = await engine.handle({
      session,
      customerMessageId: customerMessage.id,
      latestCustomerMessage: content,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      photoCount,
      quickActionEvent,
    });

    const state = await this.walkTo(session, turn.targetState);

    const assistantMessage = await messages.append(session.id, 'VERA', turn.reply);
    await audit.record({
      actorType: 'VERA',
      action: 'chat.message.assistant_created',
      entity: 'chat_message',
      entityId: assistantMessage.id,
      data: { sessionId: session.id, reviewFlagged: turn.reviewFlagged },
    });
    await this.deps.sessions.touch(session.id, this.deps.clock.now());

    return {
      messages: [toPublicMessage(customerMessage), toPublicMessage(assistantMessage)],
      state,
      summary: turn.summary,
    };
  }

  async uploadPhoto(
    sessionId: string,
    rawToken: string,
    file: UploadedFile,
  ): Promise<{ mediaId: string; photoCount: number }> {
    const session = await this.authorize(sessionId, rawToken);
    if (!chatStateMachine.isActive(session.state)) {
      throw new SessionClosedError(session.id);
    }
    const result = await this.deps.media.store({ leadId: session.leadId, sessionId: session.id, file });
    await this.deps.audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.media.uploaded',
      entity: 'lead_media',
      entityId: result.mediaId,
      data: { sessionId: session.id, photoCount: result.photoCount, sizeBytes: file.size },
    });
    await this.deps.sessions.touch(session.id, this.deps.clock.now());
    return result;
  }

  async confirmSummary(sessionId: string, rawToken: string): Promise<PublicMessagesCreatedDto> {
    const { messages, audit, clock, leadData } = this.deps;
    const session = await this.authorize(sessionId, rawToken);
    if (session.state !== 'READY_FOR_CONFIRMATION') {
      throw new ConfirmationNotAvailableError(session.id);
    }

    // Lock the collected fields and snapshot the summary for human review.
    const collected = await leadData.loadCollected(session.leadId);
    const photoCount = await leadData.countPhotos(session.leadId);
    const summary = buildSummary(collected, photoCount);
    await leadData.saveCollected(session.leadId, confirmAllPresent(collected));
    await leadData.markReadyForReview(session.leadId, summary, clock.now());

    const state = await this.transitionOnce(session, 'CONFIRMED');
    const closing = await messages.append(session.id, 'VERA', CONFIRM_CLOSING);
    await audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.session.confirmed',
      entity: 'chat_session',
      entityId: session.id,
      data: { leadReference: session.leadReference },
    });
    await this.deps.sessions.touch(session.id, clock.now());

    return { messages: [toPublicMessage(closing)], state, summary };
  }

  async correctSummary(sessionId: string, rawToken: string): Promise<PublicMessagesCreatedDto> {
    const { messages, audit, clock } = this.deps;
    const session = await this.authorize(sessionId, rawToken);
    if (session.state !== 'READY_FOR_CONFIRMATION') {
      throw new ConfirmationNotAvailableError(session.id);
    }

    const state = await this.transitionOnce(session, 'COLLECTING_PROJECT');
    const prompt = await messages.append(session.id, 'VERA', CORRECTION_PROMPT);
    await audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.summary.correction_requested',
      entity: 'chat_session',
      entityId: session.id,
    });
    await this.deps.sessions.touch(session.id, clock.now());

    return { messages: [toPublicMessage(prompt)], state, summary: null };
  }

  async getSession(sessionId: string, rawToken: string): Promise<PublicSessionDto> {
    const session = await this.authorize(sessionId, rawToken);
    const messages = await this.deps.messages.listAscending(session.id);
    const summary = await this.summaryIfReady(session);
    return toPublicSession(session, messages, summary);
  }

  async resumeSession(sessionId: string, rawToken: string): Promise<PublicSessionDto> {
    const session = await this.authorize(sessionId, rawToken);
    const messages = await this.deps.messages.listAscending(session.id);
    const summary = await this.summaryIfReady(session);
    await this.deps.sessions.touch(session.id, this.deps.clock.now());
    await this.deps.audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.session.resumed',
      entity: 'chat_session',
      entityId: session.id,
      data: { state: session.state },
    });
    return toPublicSession(session, messages, summary);
  }

  async getStatus(sessionId: string, rawToken: string): Promise<PublicStatusDto> {
    const session = await this.authorize(sessionId, rawToken);
    const messageCount = await this.deps.messages.count(session.id);
    return {
      state: session.state,
      leadReference: session.leadReference,
      messageCount,
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  /** Walk the state machine forward to `target`, auditing each single step. */
  private async walkTo(session: ChatSession, target: ChatSessionState): Promise<ChatSessionState> {
    const path = chatStateMachine.forwardPath(session.state, target);
    if (path === null || path.length === 0) {
      return session.state;
    }
    let from = session.state;
    for (const to of path) {
      chatStateMachine.assertTransition(from, to);
      await this.deps.sessions.updateState(session.id, to);
      await this.deps.audit.record({
        actorType: 'VERA',
        action: 'chat.state.changed',
        entity: 'chat_session',
        entityId: session.id,
        data: { from, to },
      });
      from = to;
    }
    return from;
  }

  /** Apply a single explicit transition (confirm → CONFIRMED, correct → COLLECTING_PROJECT). */
  private async transitionOnce(
    session: ChatSession,
    to: ChatSessionState,
  ): Promise<ChatSessionState> {
    chatStateMachine.assertTransition(session.state, to);
    await this.deps.sessions.updateState(session.id, to);
    await this.deps.audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.state.changed',
      entity: 'chat_session',
      entityId: session.id,
      data: { from: session.state, to },
    });
    return to;
  }

  private async summaryIfReady(session: ChatSession): Promise<ConfirmationSummary | null> {
    if (session.state !== 'READY_FOR_CONFIRMATION' && session.state !== 'CONFIRMED') {
      return null;
    }
    const collected = await this.deps.leadData.loadCollected(session.leadId);
    const photoCount = await this.deps.leadData.countPhotos(session.leadId);
    return buildSummary(collected, photoCount);
  }

  private async authorize(sessionId: string, rawToken: string): Promise<ChatSession> {
    const { sessions, tokens, audit, clock } = this.deps;

    const session = await sessions.findById(sessionId);
    if (session === null) {
      throw new ChatSessionNotFoundError(sessionId);
    }

    const storedHash = await sessions.findTokenHash(sessionId);
    const reason =
      storedHash === null || !tokens.verify(rawToken, storedHash)
        ? 'invalid'
        : session.resumeTokenRevokedAt !== null
          ? 'revoked'
          : session.expiresAt.getTime() <= clock.now().getTime()
            ? 'expired'
            : null;

    if (reason !== null) {
      await audit.record({
        actorType: 'SYSTEM',
        action: 'chat.resume.invalid_attempt',
        entity: 'chat_session',
        entityId: sessionId,
        data: { reason },
      });
      throw new InvalidResumeTokenError(reason);
    }

    return session;
  }
}
