import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="typing" aria-label="Vera está escribiendo">
      <span></span><span></span><span></span>
    </div>
  `,
  styles: `
    .typing {
      display: inline-flex;
      gap: 5px;
      padding: 12px 16px;
      background: #fff;
      border: 1px solid #d9d2c4;
      border-radius: 14px;
      align-self: flex-start;
    }
    span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #5c6b3a;
      animation: blink 1.2s infinite ease-in-out;
    }
    span:nth-child(2) { animation-delay: 0.15s; }
    span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes blink {
      0%, 70%, 100% { opacity: 0.25; }
      35% { opacity: 1; }
    }
  `,
})
export class TypingIndicatorComponent {}
