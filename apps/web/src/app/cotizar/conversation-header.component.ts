import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-conversation-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <div>
        <h1>Vera · Verza Garden</h1>
        <p>Asistente de cotizaciones</p>
      </div>
      <div class="right">
        @if (leadReference(); as ref) {
          <span class="ref">{{ ref }}</span>
        }
        <button type="button" class="new" (click)="newConversation.emit()">
          Nueva conversación
        </button>
      </div>
    </header>
  `,
  styles: `
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: #5c6b3a;
      color: #fff;
    }
    h1 { margin: 0; font-size: 1.05rem; font-weight: 600; }
    p { margin: 2px 0 0; font-size: 0.75rem; opacity: 0.85; }
    .right { display: flex; align-items: center; gap: 10px; }
    .ref {
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.18);
      padding: 4px 10px;
      border-radius: 12px;
      letter-spacing: 0.04em;
    }
    .new {
      font-size: 0.72rem;
      color: #fff;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 14px;
      padding: 5px 10px;
      cursor: pointer;
    }
    .new:hover { background: rgba(255, 255, 255, 0.12); }
  `,
})
export class ConversationHeaderComponent {
  readonly leadReference = input<string | null>(null);
  readonly newConversation = output<void>();
}
