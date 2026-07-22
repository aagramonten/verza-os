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
    </div>
  `,
  styles: `
    /* margin-bottom:auto absorbs the leftover height only when the sibling
       message list is not growing (the empty welcome state), which docks the
       input to the bottom while keeping these actions next to the starters.
       During a live conversation the list fills the space, so this is inert. */
    :host { display: block; margin-bottom: auto; }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 10px 16px 2px;
    }
    label,
    button {
      display: inline-flex;
      align-items: center;
      padding: 8px 13px;
      border-radius: 14px;
      border: 1px solid #d9d2c4;
      background: transparent;
      color: #5c6b3a;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    label:hover,
    button:hover:not(:disabled) { background: #e9e3d6; border-color: #c3bba7; }
    label:focus-within,
    button:focus-visible { outline: 2px solid #5c6b3a; outline-offset: 1px; }
    label.disabled,
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    @media (max-width: 480px) {
      label,
      button { padding: 10px 14px; font-size: 0.84rem; }
    }
  `,
})
export class QuickActionsComponent {
  readonly disabled = input(false);
  readonly photoCount = input(0);
  readonly requestVisit = output<void>();
  readonly skipMeasurements = output<void>();
  readonly photosSelected = output<FileList>();

  onFiles(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files !== null && target.files.length > 0) {
      this.photosSelected.emit(target.files);
    }
    target.value = ''; // allow re-selecting the same file
  }
}
