import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { MessageBubbleComponent } from './message-bubble.component';
import { TypingIndicatorComponent } from './typing-indicator.component';
import type { UiMessage } from './chat.store';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [MessageBubbleComponent, TypingIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list">
      @for (message of messages(); track message.id) {
        <app-message-bubble [message]="message" />
      } @empty {
        <p class="empty">Escríbele a Vera para comenzar tu cotización 🌿</p>
      }
      @if (showTyping()) {
        <app-typing-indicator />
      }
    </div>
  `,
  styles: `
    :host { display: block; flex: 1; overflow-y: auto; }
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      min-height: 100%;
      justify-content: flex-end;
    }
    .empty {
      text-align: center;
      color: #6b5d44;
      font-size: 0.9rem;
      margin: auto 0 12px;
    }
  `,
})
export class MessageListComponent {
  readonly messages = input.required<UiMessage[]>();
  readonly showTyping = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Keep the newest message in view whenever the list or typing state changes.
    effect(() => {
      this.messages();
      this.showTyping();
      queueMicrotask(() => {
        this.host.nativeElement.scrollTop = this.host.nativeElement.scrollHeight;
      });
    });
  }
}
