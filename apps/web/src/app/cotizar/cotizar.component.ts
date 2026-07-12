import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ChatStore } from './chat.store';
import { ConversationHeaderComponent } from './conversation-header.component';
import { MessageListComponent } from './message-list.component';
import { ChatInputComponent } from './chat-input.component';
import { SummaryCardComponent } from './summary-card.component';
import { QuickActionsComponent } from './quick-actions.component';

/**
 * /cotizar — Vera chat (Day 3). AI-generated replies, structured extraction,
 * a confirmation summary card with Confirm/Correct, quick actions, and a
 * success state. Session resume persists across refresh via localStorage.
 */
@Component({
  selector: 'app-cotizar',
  standalone: true,
  imports: [
    ConversationHeaderComponent,
    MessageListComponent,
    ChatInputComponent,
    SummaryCardComponent,
    QuickActionsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="chat-page">
      <app-conversation-header
        [leadReference]="store.leadReference()"
        (newConversation)="onNewConversation()"
      />
      @if (store.error(); as message) {
        <p class="error" role="alert">{{ message }}</p>
      }
      @if (store.restoring()) {
        <p class="restoring">Recuperando tu conversación…</p>
      }

      <app-message-list [messages]="store.messages()" [showTyping]="store.sending()" />

      @if (store.awaitingConfirmation() && store.summary(); as summary) {
        <app-summary-card
          [summary]="summary"
          [busy]="store.sending()"
          (confirm)="store.confirm()"
          (correct)="store.correct()"
        />
      }

      @if (store.confirmed()) {
        <p class="done">✅ ¡Gracias! Tu información quedó registrada. El equipo de Verza Garden te contactará.</p>
      } @else if (!store.awaitingConfirmation()) {
        <app-quick-actions
          [disabled]="!store.canSend() || store.uploading()"
          [photoCount]="store.photoCount()"
          (photosSelected)="store.uploadPhotos($event)"
          (requestVisit)="store.requestVisit()"
          (skipMeasurements)="store.skipMeasurements()"
          (hasBudget)="store.hasBudget()"
          (wantsLowMaintenance)="store.wantsLowMaintenance()"
          (wantsLuxury)="store.wantsLuxury()"
        />
        @if (store.uploading()) {
          <p class="uploading">Subiendo foto…</p>
        }
        <app-chat-input [disabled]="!store.canSend()" (send)="store.send($event)" />
      }
    </main>
  `,
  styles: `
    .chat-page {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      max-width: 640px;
      margin: 0 auto;
      background: #ede8de;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #2e2013;
    }
    .error {
      margin: 0;
      padding: 8px 16px;
      background: #8c2f28;
      color: #fff;
      font-size: 0.85rem;
      text-align: center;
    }
    .restoring,
    .uploading {
      margin: 0;
      padding: 8px 16px;
      font-size: 0.85rem;
      text-align: center;
      color: #6b5d44;
    }
    .done {
      margin: 0;
      padding: 18px 16px;
      background: #5c6b3a;
      color: #fff;
      font-size: 0.95rem;
      text-align: center;
    }
  `,
})
export class CotizarComponent implements OnInit {
  protected readonly store = inject(ChatStore);

  ngOnInit(): void {
    void this.store.init();
  }

  onNewConversation(): void {
    // Confirm only when there is a conversation in progress worth losing.
    if (this.store.messages().length > 0 && !this.store.confirmed()) {
      const ok = window.confirm('¿Empezar una conversación nueva? Se perderá el progreso actual.');
      if (!ok) {
        return;
      }
    }
    this.store.reset();
  }
}
