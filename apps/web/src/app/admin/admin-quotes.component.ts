import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService, type OfficialQuote, type ProjectSummary } from './admin-api.service';

@Component({
  selector: 'app-admin-quotes',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header>
        <div><p class="eyebrow">Verza OS</p><h1>Cotizaciones</h1><p class="muted">Revisa, aprueba y registra el envío de cotizaciones.</p></div>
        <nav><a routerLink="/admin">Dashboard</a><a routerLink="/admin/leads">Leads</a><a routerLink="/admin/agenda">Agenda</a></nav>
      </header>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <section class="layout">
        <aside class="panel">
          <h2>Proyectos</h2>
          @for (project of projects(); track project.id) {
            <button type="button" class="project" [class.active]="selectedProject()?.id === project.id" (click)="select(project)">
              <strong>{{ project.referenceNumber }}</strong><span>{{ project.title || 'Sin título' }}</span><small>{{ project.status }}</small>
            </button>
          } @empty { <p class="muted">No hay proyectos.</p> }
        </aside>
        <section class="panel detail">
          @if (selectedProject(); as project) {
            <div class="detail-head"><div><p class="eyebrow">{{ project.referenceNumber }}</p><h2>{{ project.title || 'Proyecto' }}</h2></div><button type="button" class="ghost" (click)="newDraft()">Nueva cotización</button></div>
            @if (draft()) {
              <form class="draft" (ngSubmit)="createDraft()">
                <h3>Borrador</h3>
                <label>Descripción<input name="description" [(ngModel)]="draftDescription" required /></label>
                <div class="two"><label>Cantidad<input name="quantity" type="number" min="0.001" step="0.001" [(ngModel)]="draftQuantity" /></label><label>Precio unitario (centavos)<input name="unit" type="number" min="0" step="1" [(ngModel)]="draftUnit" /></label></div>
                <label>IVU (puntos base)<input name="tax" type="number" min="0" step="1" [(ngModel)]="draftTax" /></label>
                <button class="primary" type="submit">Crear borrador</button>
              </form>
            }
            <div class="quotes">
              @for (quote of quotes(); track quote.id) {
                <article class="quote">
                  <div class="quote-head"><div><strong>Versión {{ quote.version }}</strong><span class="status">{{ quote.status }}</span></div><strong>{{ money(quote.totalCents, quote.currency) }}</strong></div>
                  <ul>@for (line of quote.lineItems; track line.description) { <li><span>{{ line.description }} × {{ line.quantityMilli / 1000 }}</span><span>{{ money(line.lineTotalCents, quote.currency) }}</span></li> }</ul>
                  <p class="muted">Subtotal {{ money(quote.subtotalCents, quote.currency) }} · Impuestos {{ money(quote.taxCents, quote.currency) }}</p>
                  <div class="actions">
                    @if (quote.status === 'DRAFT') { <button type="button" (click)="act(quote, 'submit')">Enviar a aprobación</button> }
                    @if (quote.status === 'PENDING_APPROVAL') { <button type="button" (click)="act(quote, 'approve')">Aprobar</button> }
                    @if (quote.status === 'APPROVED') { <button type="button" (click)="act(quote, 'send')">Marcar como enviada</button> }
                  </div>
                </article>
              } @empty { <p class="muted">No hay cotizaciones para este proyecto.</p> }
            </div>
          } @else { <p class="muted">Selecciona un proyecto.</p> }
        </section>
      </section>
    </main>
  `,
  styles: `
    .page{min-height:100dvh;padding:24px;background:#f4f1ea;color:#17231d;font-family:Inter,ui-sans-serif,system-ui,sans-serif} header{max-width:1120px;margin:0 auto 20px;display:flex;justify-content:space-between;gap:16px}h1,h2,h3,p{margin:0}h1{font-size:1.8rem}.eyebrow,.muted{color:#617164;font-size:.84rem}.eyebrow{font-weight:750;text-transform:uppercase;letter-spacing:.08em}nav{display:flex;gap:10px}nav a,.ghost,button{border:1px solid #cfc7b8;border-radius:6px;padding:9px 12px;background:#fffdf8;color:#23352c;font-weight:700;text-decoration:none;cursor:pointer}.layout{max-width:1120px;margin:auto;display:grid;grid-template-columns:280px 1fr;gap:14px}.panel{background:#fffdf8;border:1px solid #ddd5c7;border-radius:10px;padding:18px}.project{display:grid;text-align:left;width:100%;margin-top:8px;gap:3px}.project span,.project small{color:#617164}.project.active{border-color:#2f6f50;background:#edf4ed}.detail-head,.quote-head,.actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.detail-head{margin-bottom:18px}.quote{border-top:1px solid #e4ded2;padding:16px 0}.status{margin-left:10px;border-radius:999px;background:#edf4ed;padding:4px 8px;font-size:.75rem}.quote ul{list-style:none;padding:0;margin:12px 0}.quote li{display:flex;justify-content:space-between;padding:4px 0}.actions{justify-content:flex-end}.primary{background:#2f6f50;color:white}.draft{display:grid;gap:10px;border:1px solid #d8e3d8;background:#f6faf4;border-radius:8px;padding:14px;margin-bottom:16px}.draft label{display:grid;gap:4px;font-size:.85rem;font-weight:700}.draft input{padding:9px;border:1px solid #cfc7b8;border-radius:5px}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.error{max-width:1120px;margin:0 auto 14px;color:#a52626}@media(max-width:760px){header,.layout{display:block}.layout .panel{margin-bottom:14px}nav{margin-top:14px}.two{grid-template-columns:1fr}}
  `,
})
export class AdminQuotesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly projects = signal<ProjectSummary[]>([]);
  readonly quotes = signal<OfficialQuote[]>([]);
  readonly selectedProject = signal<ProjectSummary | null>(null);
  readonly draft = signal(false);
  readonly error = signal<string | null>(null);
  draftDescription = 'Trabajo de jardinería';
  draftQuantity = 1;
  draftUnit = 0;
  draftTax = 0;

  async ngOnInit(): Promise<void> {
    try { this.projects.set((await this.api.projects()).items); } catch { this.error.set('No se pudieron cargar los proyectos.'); }
  }

  async select(project: ProjectSummary): Promise<void> {
    this.selectedProject.set(project); this.draft.set(false); this.error.set(null);
    try { this.quotes.set((await this.api.quotes(project.id)).items); } catch { this.error.set('No se pudieron cargar las cotizaciones.'); }
  }

  newDraft(): void { this.draft.set(true); }

  async createDraft(): Promise<void> {
    const project = this.selectedProject(); if (!project) return;
    try {
      const quote = await this.api.createQuote(project.id, { currency: project.currency || 'USD', lineItems: [{ description: this.draftDescription, quantityMilli: Math.round(this.draftQuantity * 1000), unitPriceCents: Math.round(this.draftUnit) }], taxRateBps: Math.round(this.draftTax) });
      this.quotes.update((items) => [quote, ...items]); this.draft.set(false);
    } catch { this.error.set('No se pudo crear el borrador.'); }
  }

  async act(quote: OfficialQuote, action: 'submit' | 'approve' | 'send'): Promise<void> {
    const project = this.selectedProject(); if (!project) return;
    try { const updated = await this.api.quoteAction(project.id, quote.id, action); this.quotes.update((items) => items.map((item) => item.id === updated.id ? updated : item)); }
    catch { this.error.set('La transición de la cotización no pudo completarse.'); }
  }

  money(cents: number, currency: string): string { return new Intl.NumberFormat('es-PR', { style: 'currency', currency }).format(cents / 100); }
}
