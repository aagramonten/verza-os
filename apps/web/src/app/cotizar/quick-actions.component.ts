import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Lightweight action row. "Subir fotos" is intentionally disabled — media
 * uploads are a later day; the button marks the upcoming step. The other two
 * actions send canned messages so Vera handles them conversationally.
 */
@Component({
  selector: 'app-quick-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="actions">
      <button type="button" disabled title="Próximamente">📷 Subir fotos (próximamente)</button>
      <button type="button" [disabled]="disabled()" (click)="requestVisit.emit()">
        Solicitar visita
      </button>
      <button type="button" [disabled]="disabled()" (click)="skipMeasurements.emit()">
        No tengo medidas
      </button>
    </div>
  `,
  styles: `
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 16px 0;
    }
    button {
      padding: 8px 14px;
      border-radius: 20px;
      border: 1px solid #d9d2c4;
      background: #fdfaf5;
      color: #5c6b3a;
      font-size: 0.82rem;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class QuickActionsComponent {
  readonly disabled = input(false);
  readonly requestVisit = output<void>();
  readonly skipMeasurements = output<void>();
}
