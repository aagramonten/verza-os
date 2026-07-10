import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
      @if (leadReference(); as ref) {
        <span class="ref">{{ ref }}</span>
      }
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
    .ref {
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.18);
      padding: 4px 10px;
      border-radius: 12px;
      letter-spacing: 0.04em;
    }
  `,
})
export class ConversationHeaderComponent {
  readonly leadReference = input<string | null>(null);
}
