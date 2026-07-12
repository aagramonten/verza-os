import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Lightweight action row. "Añadir fotos" opens the device file picker and
 * emits the selected images; the other actions emit structured events so the
 * server can plan the turn before calling Vera.
 */
@Component({
  selector: 'app-quick-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="actions">
      <label class="upload" [class.disabled]="disabled()">
        📷 Añadir fotos@if (photoCount() > 0) {&nbsp;({{ photoCount() }})}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          hidden
          [disabled]="disabled()"
          (change)="onFiles($event)"
        />
      </label>
      <button type="button" [disabled]="disabled()" (click)="requestVisit.emit()">
        Solicitar visita
      </button>
      <button type="button" [disabled]="disabled()" (click)="skipMeasurements.emit()">
        No tengo medidas
      </button>
      <button type="button" [disabled]="disabled()" (click)="wantsLowMaintenance.emit()">
        Bajo mantenimiento
      </button>
      <button type="button" [disabled]="disabled()" (click)="wantsLuxury.emit()">
        Estilo premium
      </button>
      <button type="button" [disabled]="disabled()" (click)="hasBudget.emit()">
        Tengo presupuesto
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
    label,
    button {
      padding: 8px 14px;
      border-radius: 20px;
      border: 1px solid #d9d2c4;
      background: #fdfaf5;
      color: #5c6b3a;
      font-size: 0.82rem;
      cursor: pointer;
    }
    label.disabled,
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class QuickActionsComponent {
  readonly disabled = input(false);
  readonly photoCount = input(0);
  readonly requestVisit = output<void>();
  readonly skipMeasurements = output<void>();
  readonly hasBudget = output<void>();
  readonly wantsLowMaintenance = output<void>();
  readonly wantsLuxury = output<void>();
  readonly photosSelected = output<FileList>();

  onFiles(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files !== null && target.files.length > 0) {
      this.photosSelected.emit(target.files);
    }
    target.value = ''; // allow re-selecting the same file
  }
}
