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
  { label: '🎨 Diseño de jardín', message: 'Quiero un diseño nuevo para mi patio' },
  { label: '🌱 Grama nueva', message: 'Quiero instalar grama nueva' },
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
          <p class="pitch">
            Hola 👋 Cuéntame tu proyecto de jardín y te preparo una cotización
            <strong>gratis</strong>, en minutos.
          </p>
          <p class="hint">¿Con qué empezamos?</p>
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
      box-sizing: border-box;
      justify-content: flex-end;
    }
    .welcome {
      margin: 0 0 auto;
      padding: 4px 2px;
    }
    .pitch {
      margin: 0 0 4px;
      font-size: 0.98rem;
      line-height: 1.45;
      font-weight: 500;
      color: #2e2013;
    }
    .pitch strong { color: #4a5730; font-weight: 700; }
    .hint {
      margin: 0 0 12px;
      font-size: 0.8rem;
      color: #8a7c63;
    }
    .starters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .starters button {
      padding: 9px 14px;
      border-radius: 14px;
      border: 1px solid #d9d2c4;
      background: #fff;
      color: #3f4a28;
      font-size: 0.86rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    }
    .starters button:hover { background: #f2eee4; border-color: #c3bba7; }
    .starters button:active { transform: scale(0.98); }
    .starters button:focus-visible { outline: 2px solid #5c6b3a; outline-offset: 1px; }
    @media (max-width: 480px) {
      .starters button { padding: 11px 15px; font-size: 0.9rem; }
    }
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
