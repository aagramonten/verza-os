import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-conversation-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <span class="ctx">Verza Garden · Diseño de jardines</span>
      <div class="right">
        @if (leadReference(); as ref) {
          <span class="ref">{{ ref }}</span>
        }
        <button type="button" class="new" (click)="newConversation.emit()">
          Nueva
        </button>
      </div>
    </header>
  `,
  styles: `
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 16px;
      background: #ede8de;
      color: #6b5d44;
      border-bottom: 1px solid #ddd5c6;
    }
    .ctx {
      font-size: 0.74rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: #4a5730;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
    .ref {
      font-size: 0.7rem;
      background: #e2dccd;
      color: #5c6b3a;
      padding: 3px 9px;
      border-radius: 10px;
      letter-spacing: 0.04em;
    }
    .new {
      font-size: 0.72rem;
      font-weight: 600;
      color: #4a5730;
      background: transparent;
      border: 1px solid #cfc7b6;
      border-radius: 12px;
      padding: 5px 11px;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .new:hover { background: #e4ddce; border-color: #b9b09c; }
    .new:focus-visible { outline: 2px solid #5c6b3a; outline-offset: 1px; }
  `,
})
export class ConversationHeaderComponent {
  readonly leadReference = input<string | null>(null);
  readonly newConversation = output<void>();
}
