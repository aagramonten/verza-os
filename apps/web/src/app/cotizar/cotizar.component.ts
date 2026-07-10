import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ChatStore } from './chat.store';
import { ConversationHeaderComponent } from './conversation-header.component';
import { MessageListComponent } from './message-list.component';
import { ChatInputComponent } from './chat-input.component';

/**
 * /cotizar — Day 2 developer chat UI. Deterministic placeholder assistant;
 * the full Vera experience (photos, measurements, confirmation) arrives on
 * Days 8–9. Session resume: the token is kept in localStorage and the store
 * re-hydrates the conversation on page load.
 */
@Component({
  selector: 'app-cotizar',
  standalone: true,
  imports: [ConversationHeaderComponent, MessageListComponent, ChatInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="chat-page">
      <app-conversation-header [leadReference]="store.leadReference()" />
      @if (store.error(); as message) {
        <p class="error" role="alert">{{ message }}</p>
      }
      @if (store.restoring()) {
        <p class="restoring">Recuperando tu conversación…</p>
      }
      <app-message-list [messages]="store.messages()" [showTyping]="store.sending()" />
      <app-chat-input [disabled]="!store.canSend()" (send)="store.send($event)" />
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
    .restoring {
      margin: 0;
      padding: 8px 16px;
      font-size: 0.85rem;
      text-align: center;
      color: #6b5d44;
    }
  `,
})
export class CotizarComponent implements OnInit {
  protected readonly store = inject(ChatStore);

  ngOnInit(): void {
    void this.store.init();
  }
}
