import type { AuditLogService } from '../../../shared/audit/audit-log.service.js';
import { sanitizeChatMessage } from '../../../shared/text/sanitize.js';
import type { ChatSession } from '../domain/chat-session.js';
import {
  ChatSessionNotFoundError,
  InvalidResumeTokenError,
  SessionClosedError,
} from '../domain/errors.js';
import { chatStateMachine } from '../domain/state-machine.js';
import type {
  PublicMessagesCreatedDto,
  PublicSessionCreatedDto,
  PublicSessionDto,
  PublicStatusDto,
} from './dto.js';
import { toPublicMessage, toPublicSession } from './dto.js';
import type {
  AssistantResponder,
  ChatLeadRepository,
  ChatMessageRepository,
  ChatSessionRepository,
  Clock,
} from './ports.js';
import type { ResumeTokenService } from './resume-token.service.js';

export interface PublicChatServiceDeps {
  sessions: ChatSessionRepository;
  messages: ChatMessageRepository;
  leads: ChatLeadRepository;
  tokens: ResumeTokenService;
  assistant: AssistantResponder;
  audit: AuditLogService;
  clock: Clock;
  resumeTokenTtlDays: number;
}

/**
 * Application service for the public chat endpoints. Controllers delegate
 * here and contain no business logic. Audit metadata never includes message
 * contents, raw tokens, or PII (plan §8 / Day 2 spec).
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
    const { sessions, messages, assistant, audit } = this.deps;
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
      data: { sessionId: session.id, length: content.length },
    });

    const customerMessageCount = await this.countCustomerMessages(session.id);
    const turn = assistant.respond({ state: session.state, customerMessageCount });

    let state = session.state;
    if (turn.nextState !== null && turn.nextState !== state) {
      chatStateMachine.assertTransition(state, turn.nextState);
      await sessions.updateState(session.id, turn.nextState);
      await audit.record({
        actorType: 'VERA',
        action: 'chat.state.changed',
        entity: 'chat_session',
        entityId: session.id,
        data: { from: state, to: turn.nextState },
      });
      state = turn.nextState;
    }

    const assistantMessage = await messages.append(session.id, 'VERA', turn.reply);
    await audit.record({
      actorType: 'VERA',
      action: 'chat.message.assistant_created',
      entity: 'chat_message',
      entityId: assistantMessage.id,
      data: { sessionId: session.id },
    });
    await sessions.touch(session.id, this.deps.clock.now());

    return {
      messages: [toPublicMessage(customerMessage), toPublicMessage(assistantMessage)],
      state,
    };
  }

  async getSession(sessionId: string, rawToken: string): Promise<PublicSessionDto> {
    const session = await this.authorize(sessionId, rawToken);
    const messages = await this.deps.messages.listAscending(session.id);
    return toPublicSession(session, messages);
  }

  async resumeSession(sessionId: string, rawToken: string): Promise<PublicSessionDto> {
    const session = await this.authorize(sessionId, rawToken);
    const messages = await this.deps.messages.listAscending(session.id);
    await this.deps.sessions.touch(session.id, this.deps.clock.now());
    await this.deps.audit.record({
      actorType: 'CUSTOMER',
      action: 'chat.session.resumed',
      entity: 'chat_session',
      entityId: session.id,
      data: { state: session.state },
    });
    return toPublicSession(session, messages);
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

  /**
   * Resolves the session and verifies the resume token (existence, hash
   * match, expiry, revocation). Failures audit `chat.resume.invalid_attempt`
   * without the raw token and surface as a single opaque error type.
   */
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

  private async countCustomerMessages(sessionId: string): Promise<number> {
    const all = await this.deps.messages.listAscending(sessionId);
    return all.filter((m) => m.role === 'CUSTOMER').length;
  }
}
