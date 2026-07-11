import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ConfirmationSummary } from './chat-api.service';

@Component({
  selector: 'app-summary-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <h2>Esto es lo que entendí de tu proyecto</h2>
      <ul>
        @for (line of summary().lines; track line.label) {
          <li><span class="label">{{ line.label }}:</span> {{ line.value }}</li>
        }
      </ul>
      <p class="ask">¿Está correcto o deseas cambiar algo?</p>
      <div class="actions">
        <button class="confirm" [disabled]="busy()" (click)="confirm.emit()">Sí, está correcto</button>
        <button class="correct" [disabled]="busy()" (click)="correct.emit()">Quiero corregir algo</button>
      </div>
    </div>
  `,
  styles: `
    .card {
      margin: 10px 16px;
      padding: 18px;
      background: #fff;
      border: 1px solid #d9d2c4;
      border-radius: 14px;
    }
    h2 { margin: 0 0 12px; font-size: 1rem; color: #2e2013; }
    ul { list-style: none; margin: 0 0 12px; padding: 0; }
    li { font-size: 0.9rem; padding: 3px 0; color: #2e2013; }
    .label { color: #5c6b3a; font-weight: 600; }
    .ask { font-size: 0.9rem; margin: 0 0 14px; color: #6b5d44; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button { flex: 1; min-width: 140px; padding: 12px; border-radius: 24px; border: none; cursor: pointer; font-size: 0.9rem; }
    .confirm { background: #5c6b3a; color: #fff; }
    .correct { background: transparent; border: 1px solid #5c6b3a; color: #5c6b3a; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class SummaryCardComponent {
  readonly summary = input.required<ConfirmationSummary>();
  readonly busy = input(false);
  readonly confirm = output<void>();
  readonly correct = output<void>();
}
