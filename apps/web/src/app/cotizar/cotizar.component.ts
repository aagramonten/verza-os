import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

/**
 * /cotizar shell — Day 1 placeholder screen. The Vera chat experience
 * (welcome, message list, uploads, confirmation) arrives on Days 8–9 of the
 * approved plan (docs/vera-chat-mvp-plan.md §5).
 */
@Component({
  selector: 'app-cotizar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="cotizar">
      <h1>Verza Garden</h1>
      <p>{{ message() }}</p>
    </main>
  `,
  styles: `
    .cotizar {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: #ede8de;
      color: #2e2013;
      font-family: Georgia, 'Times New Roman', serif;
      text-align: center;
      padding: 24px;
    }
    h1 {
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    p {
      color: #5c6b3a;
      font-size: 1.1rem;
    }
  `,
})
export class CotizarComponent {
  readonly message = signal('Vera próximamente — tu asistente para cotizar tu jardín.');
}
