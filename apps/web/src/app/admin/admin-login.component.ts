import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService } from './admin-api.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-page">
      <section class="login-panel" aria-labelledby="login-title">
        <p class="eyebrow">Verza OS</p>
        <h1 id="login-title">Owner Console</h1>
        <form (ngSubmit)="submit()">
          <label>
            Email
            <input
              name="email"
              type="email"
              autocomplete="email"
              [(ngModel)]="email"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autocomplete="current-password"
              [(ngModel)]="password"
              required
            />
          </label>
          @if (error) {
            <p class="error" role="alert">{{ error }}</p>
          }
          <button type="submit" [disabled]="loading">
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: `
    .login-page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f3f0e9;
      color: #1e2a24;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .login-panel {
      width: min(100%, 380px);
      padding: 28px;
      border: 1px solid #d6d0c2;
      border-radius: 8px;
      background: #fffdf8;
      box-shadow: 0 18px 50px rgb(37 45 38 / 12%);
    }
    .eyebrow {
      margin: 0 0 8px;
      color: #607869;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 24px;
      font-size: 1.65rem;
      line-height: 1.1;
    }
    form,
    label {
      display: grid;
      gap: 10px;
    }
    form {
      gap: 16px;
    }
    label {
      color: #526257;
      font-size: 0.9rem;
      font-weight: 650;
    }
    input {
      height: 44px;
      border: 1px solid #c9c2b3;
      border-radius: 6px;
      padding: 0 12px;
      color: #17231d;
      font: inherit;
      background: #fff;
    }
    input:focus {
      outline: 3px solid #dce9df;
      border-color: #557362;
    }
    button {
      height: 46px;
      border: 0;
      border-radius: 6px;
      background: #385a46;
      color: #fff;
      font: inherit;
      font-weight: 750;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.65;
      cursor: wait;
    }
    .error {
      margin: 0;
      padding: 10px 12px;
      border-radius: 6px;
      background: #f7e6df;
      color: #7a2d1f;
      font-size: 0.88rem;
    }
  `,
})
export class AdminLoginComponent {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected loading = false;
  protected error = '';

  async submit(): Promise<void> {
    if (!this.email || !this.password || this.loading) {
      return;
    }
    this.loading = true;
    this.error = '';
    try {
      await this.api.login(this.email, this.password);
      await this.router.navigateByUrl('/admin');
    } catch {
      this.error = 'Invalid email or password.';
    } finally {
      this.loading = false;
    }
  }
}
