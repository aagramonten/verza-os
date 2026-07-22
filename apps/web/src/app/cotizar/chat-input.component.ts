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
        aria-label="Escribe tu mensaje para Vera"
        placeholder="Escribe tu mensaje…"
        [disabled]="disabled()"
        [(ngModel)]="draftValue"
        maxlength="2000"
      />
      <button
        type="submit"
        class="send"
        aria-label="Enviar"
        [disabled]="disabled() || draftValue.trim().length === 0"
      >
        <span aria-hidden="true">↑</span>
      </button>
    </form>
  `,
  styles: `
    .input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid #ddd5c6;
      background: #fdfaf5;
    }
    input {
      flex: 1;
      min-width: 0;
      padding: 11px 15px;
      border: 1px solid #d9d2c4;
      border-radius: 22px;
      font-size: 0.95rem;
      outline: none;
      background: #fff;
      color: #2e2013;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    input::placeholder { color: #a99f8a; }
    input:focus {
      border-color: #5c6b3a;
      box-shadow: 0 0 0 3px rgba(92, 107, 58, 0.15);
    }
    .send {
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: #5c6b3a;
      color: #fff;
      font-size: 1.15rem;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
    }
    .send:hover:not(:disabled) { background: #4a5730; }
    .send:active:not(:disabled) { transform: scale(0.94); }
    .send:focus-visible { outline: 2px solid #5c6b3a; outline-offset: 2px; }
    .send:disabled { opacity: 0.45; cursor: not-allowed; }
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
