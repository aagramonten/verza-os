import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ChatApiService,
  type ChatState,
  type ConfirmationSummary,
  type PublicMessage,
} from './chat-api.service';

const STORAGE_KEY = 'vg_chat_session';

interface StoredSession {
  sessionId: string;
  resumeToken: string;
}

export interface UiMessage extends PublicMessage {
  pending?: boolean;
}

/**
 * Signals-based chat store for the /cotizar developer UI.
 *
 * The resume token lives in localStorage under `vg_chat_session`; on load the
 * store attempts a resume and silently starts fresh when the token is
 * rejected (expired, revoked, or unknown).
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly api = inject(ChatApiService);

  readonly messages = signal<UiMessage[]>([]);
  readonly state = signal<ChatState | null>(null);
  readonly leadReference = signal<string | null>(null);
  readonly summary = signal<ConfirmationSummary | null>(null);
  readonly sending = signal(false);
  readonly restoring = signal(false);
  readonly error = signal<string | null>(null);

  readonly confirmed = computed(() => this.state() === 'CONFIRMED');
  readonly awaitingConfirmation = computed(() => this.state() === 'READY_FOR_CONFIRMATION');
  readonly canSend = computed(
    () => !this.sending() && !this.restoring() && !this.confirmed() && !this.awaitingConfirmation(),
  );

  async init(): Promise<void> {
    const stored = this.readStored();
    if (stored === null) {
      return;
    }
    this.restoring.set(true);
    try {
      const session = await this.api.resume(stored.sessionId, stored.resumeToken);
      this.messages.set(session.messages);
      this.state.set(session.state);
      this.leadReference.set(session.leadReference);
      this.summary.set(session.summary);
    } catch {
      // Token no longer valid: forget it and start a fresh conversation lazily.
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      this.restoring.set(false);
    }
  }

  async send(text: string): Promise<void> {
    const content = text.trim();
    if (content.length === 0 || !this.canSend()) {
      return;
    }

    this.error.set(null);
    this.sending.set(true);

    const optimistic: UiMessage = {
      id: `pending-${Date.now()}`,
      role: 'CUSTOMER',
      content,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    this.messages.update((all) => [...all, optimistic]);

    try {
      const stored = await this.ensureSession();
      const result = await this.api.sendMessage(stored.sessionId, stored.resumeToken, content);
      this.messages.update((all) => [
        ...all.filter((m) => m.id !== optimistic.id),
        ...result.messages,
      ]);
      this.state.set(result.state);
      this.summary.set(result.summary);
    } catch {
      this.messages.update((all) => all.filter((m) => m.id !== optimistic.id));
      this.error.set('No pudimos enviar tu mensaje. Intenta de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  /** Quick actions send a canned message so Vera handles them naturally. */
  requestVisit(): Promise<void> {
    return this.send('Me gustaría coordinar una visita al lugar.');
  }

  skipMeasurements(): Promise<void> {
    return this.send('No tengo las medidas exactas, prefiero que las verifiquen en la visita.');
  }

  async confirm(): Promise<void> {
    const stored = this.readStored();
    if (stored === null || this.sending()) return;
    this.sending.set(true);
    try {
      const result = await this.api.confirm(stored.sessionId, stored.resumeToken);
      this.messages.update((all) => [...all, ...result.messages]);
      this.state.set(result.state);
      this.summary.set(null);
    } catch {
      this.error.set('No pudimos confirmar. Intenta de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  async correct(): Promise<void> {
    const stored = this.readStored();
    if (stored === null || this.sending()) return;
    this.sending.set(true);
    try {
      const result = await this.api.correct(stored.sessionId, stored.resumeToken);
      this.messages.update((all) => [...all, ...result.messages]);
      this.state.set(result.state);
      this.summary.set(null);
    } catch {
      this.error.set('No pudimos procesar el cambio. Intenta de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  private async ensureSession(): Promise<StoredSession> {
    const stored = this.readStored();
    if (stored !== null) {
      return stored;
    }
    const created = await this.api.createSession();
    const fresh: StoredSession = {
      sessionId: created.sessionId,
      resumeToken: created.resumeToken,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    this.state.set(created.state);
    this.leadReference.set(created.leadReference);
    return fresh;
  }

  private readStored(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as StoredSession).sessionId === 'string' &&
        typeof (parsed as StoredSession).resumeToken === 'string'
      ) {
        return parsed as StoredSession;
      }
    } catch {
      // fall through to removal
    }
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
