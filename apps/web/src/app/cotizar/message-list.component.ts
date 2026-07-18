import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { MessageBubbleComponent } from './message-bubble.component';
import { TypingIndicatorComponent } from './typing-indicator.component';
import type { UiMessage } from './chat.store';

/** Conversation starters shown on the empty state; each sends a real first message. */
const STARTERS: ReadonlyArray<{ label: string; message: string }> = [
  { label: '🌱 Grama nueva', message: 'Quiero instalar grama nueva' },
  { label: '🎨 Diseño de jardín', message: 'Quiero un diseño nuevo para mi patio' },
  { label: '✂️ Mantenimiento', message: 'Busco mantenimiento de áreas verdes' },
  { label: '🧹 Limpieza de patio', message: 'Necesito una limpieza de patio' },
];

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
        <div class="welcome">
          <p class="greet">👋 Soy Vera.</p>
          <p class="pitch">Cuéntame tu proyecto y te preparo una cotización, gratis.</p>
          <div class="starters">
            @for (starter of starters; track starter.label) {
              <button type="button" (click)="starterSelected.emit(starter.message)">
                {{ starter.label }}
              </button>
            }
          </div>
        </div>
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
    .welcome {
      margin: auto 0 12px;
      text-align: center;
    }
    .greet {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: #2e2013;
    }
    .pitch {
      margin: 6px 0 16px;
      font-size: 0.92rem;
      color: #6b5d44;
    }
    .starters {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
    .starters button {
      padding: 10px 16px;
      border-radius: 20px;
      border: 1px solid #d9d2c4;
      background: #fff;
      color: #3f4a28;
      font-size: 0.88rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .starters button:hover { background: #f2eee4; }
  `,
})
export class MessageListComponent {
  readonly messages = input.required<UiMessage[]>();
  readonly showTyping = input(false);
  readonly starterSelected = output<string>();

  protected readonly starters = STARTERS;

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
