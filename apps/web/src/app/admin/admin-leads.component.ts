import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminApiService,
  type FollowUpStatus,
  type LeadDetail,
  type LeadListItem,
  type Slot,
} from './admin-api.service';

// Puerto Rico fixed UTC-4 (matches backend) for the visit scheduler.
const PR_OFFSET_MIN = -4 * 60;
function prDayRange(dateStr: string): { fromIso: string; toIso: string } {
  const [y, mo, day] = dateStr.split('-').map(Number);
  const from = new Date(Date.UTC(y, mo - 1, day, 0, 0) - PR_OFFSET_MIN * 60_000);
  const to = new Date(from.getTime() + 86_400_000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}
function slotTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + PR_OFFSET_MIN * 60_000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}
function todayPr(): string {
  const d = new Date(Date.now() + PR_OFFSET_MIN * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const FOLLOW_UP_LABELS: Record<FollowUpStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  IN_FOLLOW_UP: 'En seguimiento',
  CLOSED: 'Cerrado',
};

const FILTERS: Array<{ value: FollowUpStatus | null; label: string }> = [
  { value: null, label: 'Todos' },
  { value: 'NEW', label: 'Nuevos' },
  { value: 'CONTACTED', label: 'Contactados' },
  { value: 'IN_FOLLOW_UP', label: 'En seguimiento' },
  { value: 'CLOSED', label: 'Cerrados' },
];

/**
 * /admin/leads — follow-up board. Lists every lead captured by Vera with the
 * customer's contact data, lets the team change the follow-up status inline,
 * and expands a lead into its full file (summary, notes, budget, photos).
 */
@Component({
  selector: 'app-admin-leads',
  standalone: true,
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header>
        <div>
          <p class="eyebrow">Verza OS</p>
          <h1>Leads</h1>
          <p class="period">{{ total() }} en total</p>
        </div>
        <nav>
          <a routerLink="/admin" class="ghost">Dashboard</a>
          <a routerLink="/admin/agenda" class="ghost">Agenda</a>
          <button type="button" class="ghost" (click)="logout()">Salir</button>
        </nav>
      </header>

      <div class="filters" role="tablist">
        @for (f of filters; track f.label) {
          <button
            type="button"
            [class.active]="filter() === f.value"
            (click)="setFilter(f.value)"
          >
            {{ f.label }}
          </button>
        }
      </div>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else if (loading()) {
        <p class="loading">Cargando leads…</p>
      } @else if (leads().length === 0) {
        <p class="loading">No hay leads @if (filter() !== null) {con este estado}.</p>
      } @else {
        <ul class="leads">
          @for (lead of leads(); track lead.id) {
            <li [class.new]="lead.followUpStatus === 'NEW'">
              <button type="button" class="row" (click)="toggle(lead)">
                <span class="who">
                  <strong>{{ lead.customer?.name || 'Sin nombre' }}</strong>
                  <small>{{ lead.referenceNumber }} · {{ serviceLabel(lead.serviceType) }}</small>
                </span>
                <span class="contact">
                  <span>{{ lead.customer?.phone || '—' }}</span>
                  <small>{{ lead.customer?.municipality || '' }}</small>
                </span>
                <span class="date">
                  <span>{{ date(lead.createdAt) }}</span>
                  @if (lead.confirmedAt) {
                    <small class="ok">Confirmado</small>
                  } @else {
                    <small>Incompleto</small>
                  }
                </span>
                <span class="badge" [attr.data-status]="lead.followUpStatus">
                  {{ statusLabel(lead.followUpStatus) }}
                </span>
              </button>

              @if (expandedId() === lead.id) {
                <div class="detail">
                  @if (detail(); as d) {
                    <dl>
                      <div><dt>Teléfono</dt><dd>{{ d.customer?.phone || '—' }}</dd></div>
                      <div><dt>Email</dt><dd>{{ d.customer?.email || '—' }}</dd></div>
                      <div><dt>Municipio</dt><dd>{{ d.customer?.municipality || '—' }}</dd></div>
                      <div><dt>Presupuesto</dt><dd>{{ budget(d) }}</dd></div>
                      <div><dt>Fecha preferida</dt><dd>{{ d.desiredDate ? date(d.desiredDate) : '—' }}</dd></div>
                      <div><dt>Horario preferido</dt><dd>{{ d.preferredVisitTime || '—' }}</dd></div>
                      <div><dt>Fotos</dt><dd>{{ d.photoCount }}</dd></div>
                    </dl>
                    @if (d.description) {
                      <p class="notes"><strong>Proyecto:</strong> {{ d.description }}</p>
                    }
                    @if (d.adminSummary?.lines; as lines) {
                      <ul class="summary">
                        @for (line of lines; track line.label) {
                          <li><span>{{ line.label }}:</span> {{ line.value }}</li>
                        }
                      </ul>
                    }
                    <label class="status-edit">
                      Estado de seguimiento
                      <select
                        [value]="d.followUpStatus"
                        [disabled]="saving()"
                        (change)="changeStatus(d, $event)"
                      >
                        @for (s of statuses; track s) {
                          <option [value]="s" [selected]="s === d.followUpStatus">
                            {{ statusLabel(s) }}
                          </option>
                        }
                      </select>
                    </label>

                    <div class="scheduler">
                      @if (schedulingId() !== d.id) {
                        <button type="button" class="schedule-btn" (click)="openScheduler(d)">
                          📅 Agendar visita
                        </button>
                      } @else {
                        <div class="sched-panel">
                          <div class="sched-row">
                            <label>Día
                              <input type="date" [(ngModel)]="scheduleDate" (change)="loadSlots()" />
                            </label>
                            <a routerLink="/admin/agenda" class="mini-link">Ver agenda completa</a>
                          </div>
                          @if (scheduleMsg()) {
                            <p class="sched-msg" [class.warn]="scheduleWarn()">{{ scheduleMsg() }}</p>
                          }
                          @if (slotsLoading()) {
                            <p class="muted">Buscando horarios libres…</p>
                          } @else if (freeSlots().length === 0) {
                            <p class="muted">
                              No hay horarios libres ese día (revisa tus horarios en la Agenda).
                            </p>
                          } @else {
                            <div class="slots">
                              @for (slot of freeSlots(); track slot.startAt) {
                                <button
                                  type="button"
                                  [disabled]="saving()"
                                  (click)="pickSlot(d, slot)"
                                >
                                  {{ slotTimeLabel(slot.startAt) }}
                                </button>
                              }
                            </div>
                          }
                          <button type="button" class="mini-cancel" (click)="closeScheduler()">
                            Cancelar
                          </button>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="loading">Cargando detalle…</p>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </main>
  `,
  styles: `
    .page {
      min-height: 100dvh;
      padding: 24px;
      background: #f4f1ea;
      color: #17231d;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: start;
      gap: 14px;
      max-width: 980px;
      margin: 0 auto 18px;
    }
    h1, p { margin: 0; }
    h1 { font-size: 1.8rem; }
    .eyebrow, .period { color: #617164; font-size: 0.82rem; font-weight: 750; }
    nav { display: flex; gap: 10px; }
    .ghost {
      display: inline-block;
      border: 1px solid #cfc7b8;
      border-radius: 6px;
      padding: 10px 14px;
      background: #fffdf8;
      color: #23352c;
      font-weight: 750;
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: none;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-width: 980px;
      margin: 0 auto 14px;
    }
    .filters button {
      border: 1px solid #cfc7b8;
      border-radius: 16px;
      padding: 7px 14px;
      background: #fffdf8;
      color: #23352c;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .filters button.active { background: #23352c; border-color: #23352c; color: #fffdf8; }
    .leads {
      list-style: none;
      display: grid;
      gap: 10px;
      max-width: 980px;
      margin: 0 auto;
      padding: 0;
    }
    .leads li {
      border: 1px solid #d8d1c2;
      border-left: 5px solid #d8d1c2;
      border-radius: 8px;
      background: #fffdf8;
      box-shadow: 0 10px 28px rgb(35 45 38 / 8%);
      overflow: hidden;
    }
    .leads li.new { border-left-color: #b18b52; }
    .row {
      display: grid;
      grid-template-columns: 1.4fr 1fr 0.9fr auto;
      gap: 12px;
      align-items: center;
      width: 100%;
      padding: 14px 16px;
      border: none;
      background: transparent;
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .row strong { font-size: 0.98rem; }
    .row small { display: block; color: #667569; font-size: 0.78rem; margin-top: 2px; }
    .row small.ok { color: #4f795d; font-weight: 700; }
    .badge {
      justify-self: end;
      padding: 5px 12px;
      border-radius: 14px;
      font-size: 0.76rem;
      font-weight: 750;
    }
    .badge[data-status='NEW'] { background: #f4e3c8; color: #7d5a25; }
    .badge[data-status='CONTACTED'] { background: #dbe7f2; color: #2d5175; }
    .badge[data-status='IN_FOLLOW_UP'] { background: #e8e3f5; color: #4f3d80; }
    .badge[data-status='CLOSED'] { background: #dfe8df; color: #3d5a44; }
    .detail {
      padding: 4px 16px 16px;
      border-top: 1px solid #ebe5d8;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px 18px;
      margin: 12px 0;
    }
    dt { color: #667569; font-size: 0.78rem; }
    dd { margin: 2px 0 0; font-weight: 700; font-size: 0.9rem; }
    .notes { margin: 0 0 10px; font-size: 0.9rem; }
    .summary {
      list-style: none;
      margin: 0 0 12px;
      padding: 10px 12px;
      background: #f7f4ec;
      border-radius: 6px;
      display: grid;
      gap: 4px;
      font-size: 0.86rem;
    }
    .summary span { color: #617164; font-weight: 700; }
    .status-edit {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 0.85rem;
      font-weight: 750;
      color: #23352c;
    }
    select {
      padding: 8px 10px;
      border: 1px solid #cfc7b8;
      border-radius: 6px;
      background: #fff;
      font: inherit;
    }
    .scheduler { margin-top: 14px; }
    .schedule-btn {
      border: 1px solid #4f795d; border-radius: 6px; padding: 9px 14px; background: #eef3ee;
      color: #2f4a38; font-weight: 750; font-size: 0.88rem; cursor: pointer;
    }
    .sched-panel {
      border: 1px solid #d8d1c2; border-radius: 8px; padding: 12px; background: #fbf9f3;
      display: grid; gap: 10px;
    }
    .sched-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .sched-row label { display: flex; gap: 8px; align-items: center; font-size: 0.85rem; font-weight: 700; }
    .sched-row input { padding: 7px; border: 1px solid #cfc7b8; border-radius: 5px; font: inherit; }
    .mini-link { font-size: 0.8rem; color: #4f795d; font-weight: 700; }
    .sched-msg { margin: 0; font-size: 0.85rem; color: #2f4a38; font-weight: 700; }
    .sched-msg.warn { color: #7d5a25; }
    .slots { display: flex; flex-wrap: wrap; gap: 6px; }
    .slots button {
      border: 1px solid #cfc7b8; border-radius: 16px; padding: 7px 12px; background: #fff;
      color: #23352c; font-size: 0.82rem; font-weight: 700; cursor: pointer;
    }
    .slots button:hover:not(:disabled) { background: #eef3ee; border-color: #4f795d; }
    .mini-cancel { justify-self: start; border: none; background: transparent; color: #7a2d1f; font-weight: 700; cursor: pointer; padding: 0; font-size: 0.82rem; }
    .muted { color: #8a8577; font-size: 0.85rem; margin: 0; }
    .loading, .error {
      max-width: 980px;
      margin: 18px auto;
      padding: 14px 16px;
      border-radius: 8px;
      background: #fffdf8;
    }
    .error { background: #f7e6df; color: #7a2d1f; }
    @media (max-width: 720px) {
      .page { padding: 16px; }
      .row { grid-template-columns: 1fr auto; }
      .contact, .date { display: none; }
      dl { grid-template-columns: repeat(2, 1fr); }
    }
  `,
})
export class AdminLeadsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  protected readonly filters = FILTERS;
  protected readonly statuses: FollowUpStatus[] = ['NEW', 'CONTACTED', 'IN_FOLLOW_UP', 'CLOSED'];
  protected readonly leads = signal<LeadListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly filter = signal<FollowUpStatus | null>(null);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly detail = signal<LeadDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  // Visit scheduler (inline, per lead)
  protected readonly schedulingId = signal<string | null>(null);
  protected readonly freeSlots = signal<Slot[]>([]);
  protected readonly slotsLoading = signal(false);
  protected readonly scheduleMsg = signal('');
  protected readonly scheduleWarn = signal(false);
  protected scheduleDate = '';

  ngOnInit(): void {
    void this.load();
  }

  protected openScheduler(lead: LeadDetail): void {
    this.schedulingId.set(lead.id);
    this.scheduleMsg.set('');
    this.scheduleWarn.set(false);
    this.freeSlots.set([]);
    // Default to the customer's preferred date if it is in the future, else today.
    const pref = lead.desiredDate ? lead.desiredDate.slice(0, 10) : '';
    this.scheduleDate = pref && pref >= todayPr() ? pref : todayPr();
    void this.loadSlots();
  }

  protected closeScheduler(): void {
    this.schedulingId.set(null);
    this.freeSlots.set([]);
    this.scheduleMsg.set('');
  }

  protected async loadSlots(): Promise<void> {
    if (!this.scheduleDate) return;
    this.slotsLoading.set(true);
    this.scheduleMsg.set('');
    try {
      const { fromIso, toIso } = prDayRange(this.scheduleDate);
      const slots = await this.api.slots(fromIso, toIso);
      this.freeSlots.set(slots.filter((s) => s.free));
    } catch {
      this.scheduleMsg.set('No se pudieron cargar los horarios.');
      this.scheduleWarn.set(true);
    } finally {
      this.slotsLoading.set(false);
    }
  }

  protected async pickSlot(lead: LeadDetail, slot: Slot): Promise<void> {
    this.saving.set(true);
    this.scheduleMsg.set('');
    this.scheduleWarn.set(false);
    try {
      const res = await this.api.createAppointment({
        leadId: lead.id,
        scheduledAt: slot.startAt,
      });
      // Move the lead to follow-up so the board reflects that a visit is set.
      const updated = await this.api.updateLeadFollowUp(lead.id, 'IN_FOLLOW_UP');
      this.detail.set(updated);
      this.leads.update((all) =>
        all.map((l) => (l.id === lead.id ? { ...l, followUpStatus: updated.followUpStatus } : l)),
      );
      // Refresh availability first, then show the outcome (loadSlots clears the message).
      await this.loadSlots();
      if (res.conflicts.length > 0) {
        this.scheduleWarn.set(true);
        this.scheduleMsg.set('Visita agendada, pero ⚠️ hay un conflicto con otra cita o bloqueo.');
      } else {
        this.scheduleMsg.set('✅ Visita agendada. Aparece en tu Agenda.');
      }
    } catch {
      this.scheduleWarn.set(true);
      this.scheduleMsg.set('No se pudo agendar la visita.');
    } finally {
      this.saving.set(false);
    }
  }

  protected slotTimeLabel(iso: string): string {
    return slotTime(iso);
  }

  protected setFilter(value: FollowUpStatus | null): void {
    this.filter.set(value);
    this.expandedId.set(null);
    void this.load();
  }

  protected toggle(lead: LeadListItem): void {
    if (this.expandedId() === lead.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(lead.id);
    this.detail.set(null);
    void this.loadDetail(lead.id);
  }

  protected async changeStatus(lead: LeadDetail, event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value as FollowUpStatus;
    this.saving.set(true);
    try {
      const updated = await this.api.updateLeadFollowUp(lead.id, value);
      this.detail.set(updated);
      this.leads.update((all) =>
        all.map((l) => (l.id === lead.id ? { ...l, followUpStatus: updated.followUpStatus } : l)),
      );
    } catch {
      this.error.set('No se pudo actualizar el estado. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await this.api.logout();
  }

  protected statusLabel(status: FollowUpStatus): string {
    return FOLLOW_UP_LABELS[status];
  }

  protected serviceLabel(value: string | null): string {
    if (!value) {
      return 'Sin servicio';
    }
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  protected budget(lead: LeadDetail): string {
    const fmt = (cents: number): string =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(cents / 100);
    if (lead.budgetMinCents !== null && lead.budgetMaxCents !== null) {
      return `${fmt(lead.budgetMinCents)} – ${fmt(lead.budgetMaxCents)}`;
    }
    if (lead.budgetMaxCents !== null) {
      return `Hasta ${fmt(lead.budgetMaxCents)}`;
    }
    if (lead.budgetMinCents !== null) {
      return `Desde ${fmt(lead.budgetMinCents)}`;
    }
    return '—';
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.api.leads(this.filter() ?? undefined);
      this.leads.set(page.items);
      this.total.set(page.total);
    } catch (err: unknown) {
      this.error.set(this.describeLoadError(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Turn a load failure into a message that points at the real cause. A true
   * session problem asks the user to sign in again; anything else (server or
   * network) must not, so a transient 5xx or lost connection is never mistaken
   * for an expired login.
   */
  private describeLoadError(err: unknown): string {
    if (err instanceof Error && err.message === 'Authentication required') {
      return 'Tu sesión expiró. Inicia sesión de nuevo.';
    }
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status: number }).status
        : undefined;
    if (status === 401) {
      return 'Tu sesión expiró. Inicia sesión de nuevo.';
    }
    if (status === undefined || status === 0) {
      return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    }
    return `No se pudieron cargar los leads (error ${status}). Intenta de nuevo en un momento.`;
  }

  private async loadDetail(id: string): Promise<void> {
    try {
      this.detail.set(await this.api.leadDetail(id));
    } catch {
      this.error.set('No se pudo cargar el detalle del lead.');
    }
  }
}
