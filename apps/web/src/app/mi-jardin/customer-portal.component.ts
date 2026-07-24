import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CustomerPortalApiService,
  type CustomerPortalProject,
  type CustomerProjectServiceType,
  type CustomerProjectStatus,
} from './customer-portal-api.service';

const STATUS_LABELS: Record<CustomerProjectStatus, string> = {
  PLANNED: 'En preparación',
  IN_PROGRESS: 'En progreso',
  ON_HOLD: 'En pausa',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const SERVICE_LABELS: Record<CustomerProjectServiceType, string> = {
  DESIGN_INSTALLATION: 'Diseño e instalación',
  LAWN: 'Grama',
  IRRIGATION: 'Riego',
  LIGHTING: 'Iluminación',
  PLANTING: 'Siembra',
  CLEANUP: 'Limpieza',
  MAINTENANCE: 'Mantenimiento',
  OTHER: 'Proyecto de jardín',
};

@Component({
  selector: 'app-customer-portal',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="portal">
      <header class="topbar">
        <a class="brand" routerLink="/mi-jardin">
          <span class="brand-mark" aria-hidden="true">V</span>
          <span>
            <strong>Verza Garden</strong>
            <small>Mi jardín</small>
          </span>
        </a>
        <button type="button" class="logout" [disabled]="loggingOut()" (click)="logout()">
          {{ loggingOut() ? 'Saliendo…' : 'Salir' }}
        </button>
      </header>

      <div class="content">
        <section class="welcome" aria-labelledby="portal-title">
          <p class="eyebrow">Tu espacio</p>
          <h1 id="portal-title">
            Hola@if (api.customer()?.name; as name) {, {{ name }}}
          </h1>
          <p>
            Aquí puedes ver el estado actual de los proyectos que trabajamos contigo.
          </p>
          @if (api.customer()?.municipality; as municipality) {
            <span class="location">{{ municipality }}, Puerto Rico</span>
          }
        </section>

        @if (loading()) {
          <section class="loading" aria-live="polite">
            <span aria-hidden="true"></span>
            Cargando tus proyectos…
          </section>
        } @else if (error()) {
          <section class="notice error" role="alert">
            <h2>No pudimos cargar tus proyectos</h2>
            <p>{{ error() }}</p>
            <button type="button" (click)="loadProjects()">Intentar de nuevo</button>
          </section>
        } @else if (projects().length === 0) {
          <section class="notice empty">
            <span class="leaf" aria-hidden="true">✦</span>
            <p class="eyebrow">Empecemos algo nuevo</p>
            <h2>Aún no tienes proyectos aquí</h2>
            <p>Cuéntale a Vera qué área de tu jardín quieres transformar.</p>
            <a routerLink="/cotizar">Hablar con Vera</a>
          </section>
        } @else {
          <section class="projects" aria-labelledby="projects-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Vista general</p>
                <h2 id="projects-title">Tus proyectos</h2>
              </div>
              <span>{{ projects().length }} {{ projects().length === 1 ? 'proyecto' : 'proyectos' }}</span>
            </div>

            <div class="project-grid">
              @for (project of projects(); track project.referenceNumber) {
                <article class="project-card">
                  <div class="card-head">
                    <span class="reference">{{ project.referenceNumber }}</span>
                    <span class="status" [attr.data-status]="project.status">
                      <i aria-hidden="true"></i>
                      {{ statusLabel(project.status) }}
                    </span>
                  </div>
                  <h3>{{ project.title || serviceLabel(project.serviceType) }}</h3>
                  @if (project.title && project.serviceType) {
                    <p class="service">{{ serviceLabel(project.serviceType) }}</p>
                  }

                  <div class="progress" aria-hidden="true">
                    <span [class.active]="hasReached(project.status, 'PLANNED')"></span>
                    <span [class.active]="hasReached(project.status, 'IN_PROGRESS')"></span>
                    <span [class.active]="hasReached(project.status, 'COMPLETED')"></span>
                  </div>

                  <dl>
                    @if (project.contractSignedAt) {
                      <div>
                        <dt>Confirmado</dt>
                        <dd>{{ formatDate(project.contractSignedAt) }}</dd>
                      </div>
                    }
                    @if (project.startedAt) {
                      <div>
                        <dt>Comenzó</dt>
                        <dd>{{ formatDate(project.startedAt) }}</dd>
                      </div>
                    }
                    @if (project.completedAt) {
                      <div>
                        <dt>Completado</dt>
                        <dd>{{ formatDate(project.completedAt) }}</dd>
                      </div>
                    }
                  </dl>
                </article>
              }
            </div>
          </section>
        }

        <aside class="help">
          <div>
            <strong>¿Pensando en otro espacio?</strong>
            <p>Vera puede ayudarte a organizar la idea.</p>
          </div>
          <a routerLink="/cotizar">Comenzar proyecto</a>
        </aside>
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background:
        radial-gradient(circle at 85% 0%, rgb(115 139 77 / 12%), transparent 32rem),
        #f3efe5;
      color: #26351f;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    }
    * {
      box-sizing: border-box;
    }
    .portal {
      min-height: 100dvh;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 76px;
      padding: 14px max(22px, calc((100% - 1080px) / 2));
      border-bottom: 1px solid rgb(112 110 89 / 18%);
      background: rgb(255 253 248 / 74%);
      backdrop-filter: blur(12px);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 11px;
      color: #34472b;
      text-decoration: none;
    }
    .brand-mark {
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border-radius: 50%;
      background: #52683d;
      color: #fffdf8;
      font-family: Georgia, serif;
      font-size: 1.2rem;
    }
    .brand > span:last-child {
      display: grid;
      gap: 1px;
    }
    .brand strong {
      font-size: 0.9rem;
      letter-spacing: 0.01em;
    }
    .brand small {
      color: #78816f;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .logout {
      padding: 8px 13px;
      border: 1px solid #cec6b6;
      border-radius: 8px;
      background: #fffdf8;
      color: #4d5c44;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 750;
      cursor: pointer;
    }
    .logout:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    .content {
      width: min(calc(100% - 36px), 1080px);
      margin: 0 auto;
      padding: 62px 0 44px;
    }
    .welcome {
      max-width: 650px;
      margin-bottom: 52px;
    }
    h1,
    h2,
    h3,
    p {
      margin: 0;
    }
    h1,
    h2,
    h3 {
      color: #25321f;
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 500;
    }
    h1 {
      margin-bottom: 12px;
      font-size: clamp(2.35rem, 7vw, 4.2rem);
      line-height: 1;
    }
    .welcome > p:not(.eyebrow) {
      color: #65705e;
      font-size: 1rem;
      line-height: 1.6;
    }
    .eyebrow {
      margin-bottom: 9px;
      color: #60754d;
      font-size: 0.72rem;
      font-weight: 850;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .location {
      display: inline-block;
      margin-top: 14px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #e5e9dc;
      color: #536247;
      font-size: 0.75rem;
      font-weight: 750;
    }
    .loading {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 120px;
      color: #65705e;
    }
    .loading span {
      width: 18px;
      height: 18px;
      border: 2px solid #c9cfbf;
      border-top-color: #52683d;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 18px;
    }
    .section-heading h2 {
      font-size: 1.8rem;
    }
    .section-heading > span {
      color: #778070;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .project-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .project-card {
      min-height: 245px;
      padding: 23px;
      border: 1px solid #d9d2c4;
      border-radius: 14px;
      background: rgb(255 253 248 / 92%);
      box-shadow: 0 14px 40px rgb(48 55 35 / 6%);
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 26px;
    }
    .reference {
      color: #858273;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #52683d;
      font-size: 0.7rem;
      font-weight: 800;
    }
    .status i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .status[data-status='ON_HOLD'] {
      color: #99713a;
    }
    .status[data-status='CANCELLED'] {
      color: #8b665f;
    }
    .project-card h3 {
      margin-bottom: 7px;
      font-size: 1.5rem;
      line-height: 1.15;
    }
    .service {
      color: #737b6d;
      font-size: 0.82rem;
    }
    .progress {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
      margin: 28px 0 20px;
    }
    .progress span {
      height: 4px;
      border-radius: 999px;
      background: #e1ded4;
    }
    .progress span.active {
      background: #6b8056;
    }
    dl {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      margin: 0;
    }
    dl div {
      display: grid;
      gap: 3px;
    }
    dt {
      color: #929083;
      font-size: 0.65rem;
      font-weight: 750;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    dd {
      margin: 0;
      color: #505d49;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .notice {
      display: grid;
      justify-items: center;
      min-height: 300px;
      padding: 48px 24px;
      border: 1px solid #d9d2c4;
      border-radius: 16px;
      background: rgb(255 253 248 / 90%);
      text-align: center;
    }
    .notice h2 {
      margin-bottom: 10px;
      font-size: 1.8rem;
    }
    .notice > p:not(.eyebrow) {
      max-width: 430px;
      color: #697263;
      line-height: 1.55;
    }
    .notice a,
    .notice button {
      margin-top: 24px;
      padding: 11px 17px;
      border: 0;
      border-radius: 9px;
      background: #52683d;
      color: #fff;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }
    .leaf {
      display: grid;
      width: 50px;
      height: 50px;
      place-items: center;
      margin-bottom: 24px;
      border-radius: 50%;
      background: #e5e9dc;
      color: #60754d;
      font-size: 1.3rem;
    }
    .notice.error {
      border-color: #e3c8bd;
      background: #fffaf7;
    }
    .help {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      margin-top: 40px;
      padding: 23px 26px;
      border-radius: 13px;
      background: #3f5133;
      color: #fff;
    }
    .help strong {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.1rem;
      font-weight: 500;
    }
    .help p {
      margin-top: 4px;
      color: #d8e0d1;
      font-size: 0.8rem;
    }
    .help a {
      flex: 0 0 auto;
      padding: 10px 14px;
      border-radius: 8px;
      background: #fffdf8;
      color: #3f5133;
      font-size: 0.78rem;
      font-weight: 800;
      text-decoration: none;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (max-width: 720px) {
      .content {
        padding-top: 42px;
      }
      .welcome {
        margin-bottom: 38px;
      }
      .project-grid {
        grid-template-columns: 1fr;
      }
      .project-card {
        min-height: auto;
      }
      .help {
        align-items: flex-start;
        flex-direction: column;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .loading span {
        animation: none;
      }
    }
  `,
})
export class CustomerPortalComponent implements OnInit {
  protected readonly api = inject(CustomerPortalApiService);
  private readonly router = inject(Router);

  protected readonly projects = signal<CustomerPortalProject[]>([]);
  protected readonly loading = signal(true);
  protected readonly loggingOut = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.loadProjects();
  }

  protected async loadProjects(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.projects.set(await this.api.projects());
    } catch {
      if (!this.api.hasSession()) {
        await this.router.navigateByUrl('/mi-jardin/acceso');
        return;
      }
      this.error.set('Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async logout(): Promise<void> {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    try {
      await this.api.logout();
    } catch {
      // CustomerPortalApiService clears the local session in a finally block.
      // Logout remains successful from the browser's point of view.
    } finally {
      await this.router.navigateByUrl('/mi-jardin/acceso');
      this.loggingOut.set(false);
    }
  }

  protected statusLabel(status: CustomerProjectStatus): string {
    return STATUS_LABELS[status];
  }

  protected serviceLabel(serviceType: CustomerProjectServiceType | null): string {
    return serviceType === null ? 'Proyecto de jardín' : SERVICE_LABELS[serviceType];
  }

  protected hasReached(status: CustomerProjectStatus, step: CustomerProjectStatus): boolean {
    if (status === 'CANCELLED') {
      return false;
    }
    const order: CustomerProjectStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
    const current = status === 'ON_HOLD' ? 'IN_PROGRESS' : status;
    return order.indexOf(current) >= order.indexOf(step);
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Fecha pendiente';
    }
    return new Intl.DateTimeFormat('es-PR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Puerto_Rico',
    }).format(date);
  }
}
