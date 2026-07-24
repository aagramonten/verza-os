import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerPortalApiService } from './customer-portal-api.service';

@Component({
  selector: 'app-customer-access',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="portal-page">
      <section class="access-card" aria-labelledby="access-title">
        <a class="brand" routerLink="/cotizar" aria-label="Verza Garden">
          <span class="brand-mark" aria-hidden="true">V</span>
          <span>Verza Garden</span>
        </a>

        @if (sent()) {
          <div class="success" role="status">
            <span class="success-mark" aria-hidden="true">✓</span>
            <p class="eyebrow">Revisa tu correo</p>
            <h1 id="access-title">Te enviamos las instrucciones</h1>
            <p>
              Si encontramos una cuenta con ese email, recibirás un enlace para entrar a
              Mi jardín.
            </p>
            <p class="hint">El enlace expira pronto y solo se puede usar una vez.</p>
            <button type="button" class="text-button" (click)="reset()">Usar otro email</button>
          </div>
        } @else {
          <p class="eyebrow">Mi jardín</p>
          <h1 id="access-title">Entra a ver tus proyectos</h1>
          <p class="intro">
            Escribe el email que compartiste con Verza Garden. No necesitas contraseña.
          </p>

          <form (ngSubmit)="submit()">
            <label for="customer-email">Email</label>
            <input
              id="customer-email"
              name="email"
              type="email"
              autocomplete="email"
              inputmode="email"
              placeholder="tu@email.com"
              [(ngModel)]="email"
              [disabled]="loading()"
              required
            />
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <button class="primary" type="submit" [disabled]="loading() || !email.trim()">
              {{ loading() ? 'Enviando…' : 'Enviarme un enlace' }}
            </button>
          </form>

          @if (hasExistingSession) {
            <a class="return-link" routerLink="/mi-jardin">Volver a mis proyectos</a>
          }
        }

        <footer>
          <a routerLink="/cotizar">¿Tienes un proyecto nuevo? Habla con Vera</a>
        </footer>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background:
        radial-gradient(circle at 12% 15%, rgb(110 133 73 / 14%), transparent 28rem),
        #f3efe5;
      color: #26351f;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    }
    .portal-page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 28px 18px;
      box-sizing: border-box;
    }
    .access-card {
      width: min(100%, 430px);
      padding: 32px;
      border: 1px solid #d8d0c0;
      border-radius: 18px;
      background: rgb(255 253 248 / 96%);
      box-shadow: 0 24px 70px rgb(50 55 36 / 12%);
      box-sizing: border-box;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 42px;
      color: #34472b;
      font-size: 0.9rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-decoration: none;
    }
    .brand-mark {
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      border-radius: 50%;
      background: #52683d;
      color: #fffdf8;
      font-family: Georgia, serif;
      font-size: 1.1rem;
    }
    h1,
    p {
      margin: 0;
    }
    h1 {
      margin-bottom: 14px;
      color: #23301d;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(1.9rem, 8vw, 2.45rem);
      font-weight: 500;
      line-height: 1.08;
    }
    .eyebrow {
      margin-bottom: 8px;
      color: #60754d;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }
    .intro,
    .success > p:not(.eyebrow) {
      color: #65705e;
      font-size: 0.96rem;
      line-height: 1.6;
    }
    form {
      display: grid;
      gap: 10px;
      margin-top: 28px;
    }
    label {
      color: #405038;
      font-size: 0.86rem;
      font-weight: 750;
    }
    input {
      width: 100%;
      height: 50px;
      padding: 0 14px;
      border: 1px solid #c9c1b1;
      border-radius: 10px;
      background: #fff;
      color: #24311f;
      font: inherit;
      box-sizing: border-box;
    }
    input:focus {
      border-color: #61784d;
      outline: 3px solid rgb(97 120 77 / 15%);
    }
    input:disabled {
      opacity: 0.7;
    }
    .primary {
      height: 50px;
      margin-top: 6px;
      border: 0;
      border-radius: 10px;
      background: #52683d;
      color: #fff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    .primary:hover:not(:disabled) {
      background: #425431;
    }
    .primary:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    .error {
      padding: 10px 12px;
      border-radius: 8px;
      background: #f7e8e1;
      color: #812f24;
      font-size: 0.84rem;
      line-height: 1.4;
    }
    .success-mark {
      display: grid;
      width: 52px;
      height: 52px;
      place-items: center;
      margin-bottom: 24px;
      border-radius: 50%;
      background: #e4ecdc;
      color: #52683d;
      font-size: 1.45rem;
      font-weight: 800;
    }
    .hint {
      margin-top: 14px !important;
      font-size: 0.82rem !important;
    }
    .text-button {
      margin-top: 22px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #52683d;
      font: inherit;
      font-size: 0.88rem;
      font-weight: 800;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .return-link {
      display: block;
      margin-top: 18px;
      color: #52683d;
      font-size: 0.88rem;
      font-weight: 750;
      text-align: center;
    }
    footer {
      margin-top: 38px;
      padding-top: 20px;
      border-top: 1px solid #e3ddcf;
      text-align: center;
    }
    footer a {
      color: #697760;
      font-size: 0.8rem;
      font-weight: 650;
      text-decoration: none;
    }
    footer a:hover {
      color: #415133;
      text-decoration: underline;
    }
    @media (max-width: 480px) {
      .portal-page {
        padding: 0;
      }
      .access-card {
        min-height: 100dvh;
        padding: 28px 22px;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .brand {
        margin-bottom: 56px;
      }
    }
  `,
})
export class CustomerAccessComponent {
  private readonly api = inject(CustomerPortalApiService);

  protected email = '';
  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected readonly hasExistingSession = this.api.hasSession();

  protected async submit(): Promise<void> {
    const email = this.email.trim();
    if (!email || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.api.requestAccess(email);
      this.sent.set(true);
    } catch (error: unknown) {
      this.error.set(
        statusOf(error) === 429
          ? 'Hiciste varios intentos. Espera un momento e inténtalo de nuevo.'
          : 'No pudimos enviar el enlace ahora. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected reset(): void {
    this.email = '';
    this.error.set('');
    this.sent.set(false);
  }
}

function statusOf(error: unknown): number | null {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
    ? error.status
    : null;
}
