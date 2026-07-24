import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CustomerPortalApiService } from './customer-portal-api.service';

@Component({
  selector: 'app-customer-verify',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="verify-page">
      <section aria-live="polite">
        <span class="mark" [class.error]="failed()" aria-hidden="true">
          {{ failed() ? '!' : 'V' }}
        </span>
        @if (failed()) {
          <p class="eyebrow">No pudimos abrir el enlace</p>
          <h1>Solicita uno nuevo</h1>
          <p>El enlace puede haber expirado o ya fue utilizado.</p>
          <a routerLink="/mi-jardin/acceso">Volver al acceso</a>
        } @else {
          <p class="eyebrow">Mi jardín</p>
          <h1>Abriendo tu espacio…</h1>
          <p>Estamos verificando tu enlace de forma segura.</p>
        }
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: #f3efe5;
      color: #26351f;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    }
    .verify-page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    section {
      max-width: 430px;
    }
    .mark {
      display: grid;
      width: 62px;
      height: 62px;
      place-items: center;
      margin: 0 auto 28px;
      border-radius: 50%;
      background: #52683d;
      color: #fff;
      font-family: Georgia, serif;
      font-size: 1.35rem;
      box-shadow: 0 0 0 10px rgb(82 104 61 / 9%);
      animation: pulse 1.4s ease-in-out infinite;
    }
    .mark.error {
      background: #8a473b;
      box-shadow: 0 0 0 10px rgb(138 71 59 / 9%);
      animation: none;
    }
    h1,
    p {
      margin: 0;
    }
    h1 {
      margin-bottom: 12px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(2rem, 8vw, 2.6rem);
      font-weight: 500;
    }
    .eyebrow {
      margin-bottom: 8px;
      color: #60754d;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }
    section > p:not(.eyebrow) {
      color: #65705e;
      line-height: 1.55;
    }
    a {
      display: inline-block;
      margin-top: 26px;
      padding: 12px 18px;
      border-radius: 9px;
      background: #52683d;
      color: #fff;
      font-weight: 800;
      text-decoration: none;
    }
    @keyframes pulse {
      50% {
        box-shadow: 0 0 0 16px rgb(82 104 61 / 4%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .mark {
        animation: none;
      }
    }
  `,
})
export class CustomerVerifyComponent implements OnInit {
  private readonly api = inject(CustomerPortalApiService);
  private readonly router = inject(Router);

  protected readonly failed = signal(false);

  ngOnInit(): void {
    const token = magicTokenFrom(window.location.hash);
    window.history.replaceState(window.history.state, '', '/mi-jardin/verificar');
    if (!token?.trim()) {
      this.failed.set(true);
      return;
    }
    void this.verify(token);
  }

  private async verify(token: string): Promise<void> {
    try {
      await this.api.verifyAccess(token);
      await this.router.navigateByUrl('/mi-jardin', { replaceUrl: true });
    } catch {
      this.api.clearSession();
      this.failed.set(true);
    }
  }
}

function magicTokenFrom(fragment: string): string | null {
  const value = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  return new URLSearchParams(value).get('token');
}
