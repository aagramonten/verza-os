import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { UiMessage } from './chat.store';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bubble" [class.customer]="message().role === 'CUSTOMER'" [class.pending]="message().pending">
      <p>{{ message().content }}</p>
    </div>
  `,
  styles: `
    .bubble {
      max-width: 78%;
      padding: 10px 14px;
      border-radius: 14px;
      background: #fff;
      border: 1px solid #d9d2c4;
      align-self: flex-start;
      white-space: pre-line;
    }
    .bubble.customer {
      background: #5c6b3a;
      color: #fff;
      border-color: #5c6b3a;
      align-self: flex-end;
    }
    .bubble.pending { opacity: 0.6; }
    p { margin: 0; font-size: 0.95rem; line-height: 1.5; }
  `,
})
export class MessageBubbleComponent {
  readonly message = input.required<UiMessage>();
}
