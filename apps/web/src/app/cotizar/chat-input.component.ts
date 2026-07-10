import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="input-row" (ngSubmit)="submit()">
      <input
        name="message"
        type="text"
        autocomplete="off"
        placeholder="Escribe tu mensaje…"
        [disabled]="disabled()"
        [(ngModel)]="draftValue"
        maxlength="2000"
      />
      <button type="submit" [disabled]="disabled() || draftValue.trim().length === 0">
        Enviar
      </button>
    </form>
  `,
  styles: `
    .input-row {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid #d9d2c4;
      background: #fdfaf5;
    }
    input {
      flex: 1;
      padding: 12px 14px;
      border: 1px solid #d9d2c4;
      border-radius: 24px;
      font-size: 0.95rem;
      outline: none;
      background: #fff;
    }
    input:focus { border-color: #5c6b3a; }
    button {
      padding: 0 22px;
      border: none;
      border-radius: 24px;
      background: #5c6b3a;
      color: #fff;
      font-size: 0.95rem;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class ChatInputComponent {
  readonly disabled = input(false);
  readonly send = output<string>();

  draftValue = '';

  submit(): void {
    const text = this.draftValue.trim();
    if (text.length === 0) {
      return;
    }
    this.send.emit(text);
    this.draftValue = '';
  }
}
