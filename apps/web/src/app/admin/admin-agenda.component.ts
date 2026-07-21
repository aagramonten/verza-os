import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminApiService,
  type Appointment,
  type AppointmentStatus,
  type Availability,
} from './admin-api.service';

// Puerto Rico is a fixed UTC-4 (no DST) — matches the backend. All wall-clock
// display is computed with this offset so it is correct regardless of the
// viewer's own timezone.
const PR_OFFSET_MIN = -4 * 60;
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PROPOSED: 'Propuesta',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

interface PrParts {
  y: number;
  mo: number;
  day: number;
  weekday: number;
  minuteOfDay: number;
}

function prParts(iso: string | Date): PrParts {
  const d = new Date(new Date(iso).getTime() + PR_OFFSET_MIN * 60_000);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    minuteOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** PR local wall-clock (y, mo, day, minuteOfDay) → the UTC instant. */
function prLocalToUtc(y: number, mo: number, day: number, minuteOfDay: number): Date {
  return new Date(Date.UTC(y, mo, day, 0, minuteOfDay) - PR_OFFSET_MIN * 60_000);
}

function hhmm(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

interface DayColumn {
  label: string;
  dateLabel: string;
  y: number;
  mo: number;
  day: number;
  weekday: number;
  isToday: boolean;
  hours: string; // "8:00am–4:00pm" or "Cerrado"
  blocks: Array<{ id: string; label: string }>;
  appointments: Appointment[];
}

interface DayHoursForm {
  enabled: boolean;
  start: string; // "08:00"
  end: string; // "16:00"
}

@Component({
  selector: 'app-admin-agenda',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header>
        <div>
          <p class="eyebrow">Verza OS</p>
          <h1>Agenda</h1>
          <p class="period">{{ weekLabel() }}</p>
        </div>
        <nav>
          <a routerLink="/admin" class="ghost">Dashboard</a>
          <a routerLink="/admin/leads" class="ghost">Leads</a>
          <button type="button" class="ghost" (click)="logout()">Salir</button>
        </nav>
      </header>

      <div class="toolbar">
        <div class="nav">
          <button type="button" (click)="prevWeek()">‹ Semana</button>
          <button type="button" (click)="thisWeek()">Hoy</button>
          <button type="button" (click)="nextWeek()">Semana ›</button>
        </div>
        <button type="button" class="ghost" (click)="showSettings.set(!showSettings())">
          {{ showSettings() ? 'Cerrar configuración' : 'Configurar disponibilidad' }}
        </button>
      </div>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      @if (showSettings()) {
        <section class="settings">
          <h2>Mis horarios de trabajo</h2>
          <div class="days">
            @for (d of hoursForm(); track $index) {
              <label class="day-row">
                <input type="checkbox" [(ngModel)]="d.enabled" />
                <span class="dname">{{ weekdayNames[$index] }}</span>
                <input type="time" [(ngModel)]="d.start" [disabled]="!d.enabled" />
                <span>a</span>
                <input type="time" [(ngModel)]="d.end" [disabled]="!d.enabled" />
              </label>
            }
          </div>
          <div class="visit-len">
            <label>Duración de visita (min)
              <input type="number" min="15" max="480" step="15" [(ngModel)]="visitMinutes" />
            </label>
            <button type="button" class="primary" [disabled]="saving()" (click)="saveHours()">
              Guardar horarios
            </button>
          </div>

          <h2>Bloqueos (días/horas no disponibles)</h2>
          <div class="block-add">
            <input type="date" [(ngModel)]="blockDate" />
            <input type="time" [(ngModel)]="blockStart" />
            <span>a</span>
            <input type="time" [(ngModel)]="blockEnd" />
            <input type="text" placeholder="Motivo (opcional)" [(ngModel)]="blockReason" />
            <button type="button" [disabled]="saving()" (click)="addBlock()">Añadir bloqueo</button>
          </div>
          @if (availability(); as a) {
            <ul class="block-list">
              @for (b of a.blocks; track b.id) {
                <li>
                  <span>{{ blockLabel(b.startAt, b.endAt) }}{{ b.reason ? ' · ' + b.reason : '' }}</span>
                  <button type="button" (click)="removeBlock(b.id)">Quitar</button>
                </li>
              } @empty {
                <li class="muted">Sin bloqueos.</li>
              }
            </ul>
          }
        </section>
      }

      @if (loading()) {
        <p class="loading">Cargando agenda…</p>
      } @else {
        <section class="week">
          @for (col of columns(); track col.label + col.day) {
            <article class="col" [class.today]="col.isToday">
              <header class="col-head">
                <strong>{{ col.label }}</strong>
                <small>{{ col.dateLabel }}</small>
              </header>
              <p class="col-hours" [class.closed]="col.hours === 'Cerrado'">{{ col.hours }}</p>
              @for (b of col.blocks; track b.id) {
                <div class="block">🚫 {{ b.label }}</div>
              }
              @for (appt of col.appointments; track appt.id) {
                <button
                  type="button"
                  class="appt"
                  [attr.data-status]="appt.status"
                  (click)="select(appt)"
                >
                  <span class="time">{{ apptTime(appt) }}</span>
                  <span class="who">{{ appt.lead?.customerName || 'Cliente' }}</span>
                  <span class="svc">{{ serviceLabel(appt.lead?.serviceType) }}</span>
                  <span class="badge">{{ statusLabel(appt.status) }}</span>
                </button>
              }
              @if (col.appointments.length === 0 && col.blocks.length === 0) {
                <p class="empty">—</p>
              }
            </article>
          }
        </section>
      }

      @if (selected(); as appt) {
        <div class="modal-backdrop" (click)="selected.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>{{ appt.lead?.customerName || 'Cliente' }} · {{ apptDayTime(appt) }}</h3>
            <p class="modal-sub">
              {{ appt.lead?.referenceNumber }} · {{ serviceLabel(appt.lead?.serviceType) }}
              @if (appt.lead?.customerPhone) { · {{ appt.lead?.customerPhone }} }
            </p>
            <label class="modal-status">
              Estado
              <select [value]="appt.status" (change)="changeStatus(appt, $event)" [disabled]="saving()">
                @for (s of statuses; track s) {
                  <option [value]="s" [selected]="s === appt.status">{{ statusLabel(s) }}</option>
                }
              </select>
            </label>
            <button type="button" class="ghost" (click)="selected.set(null)">Cerrar</button>
          </div>
        </div>
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
      max-width: 1180px;
      margin: 0 auto 14px;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 1.8rem; }
    .eyebrow, .period { color: #617164; font-size: 0.82rem; font-weight: 750; }
    nav { display: flex; gap: 10px; }
    .ghost {
      display: inline-block; border: 1px solid #cfc7b8; border-radius: 6px; padding: 9px 13px;
      background: #fffdf8; color: #23352c; font-weight: 750; font-size: 0.88rem; cursor: pointer;
      text-decoration: none;
    }
    .toolbar {
      max-width: 1180px; margin: 0 auto 14px; display: flex; justify-content: space-between;
      align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .nav { display: flex; gap: 8px; }
    .nav button {
      border: 1px solid #cfc7b8; border-radius: 6px; padding: 8px 12px; background: #fffdf8;
      color: #23352c; font-weight: 700; font-size: 0.85rem; cursor: pointer;
    }
    .settings {
      max-width: 1180px; margin: 0 auto 16px; padding: 16px; background: #fffdf8;
      border: 1px solid #d8d1c2; border-radius: 8px;
    }
    .settings h2 { font-size: 1rem; margin: 6px 0 10px; }
    .days { display: grid; gap: 6px; }
    .day-row { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
    .day-row .dname { width: 44px; font-weight: 700; }
    .day-row input[type=time] { padding: 5px; border: 1px solid #cfc7b8; border-radius: 5px; }
    .visit-len { display: flex; align-items: center; gap: 14px; margin: 12px 0 4px; flex-wrap: wrap; }
    .visit-len label { font-size: 0.9rem; font-weight: 700; display: flex; gap: 8px; align-items: center; }
    .visit-len input { width: 80px; padding: 6px; border: 1px solid #cfc7b8; border-radius: 5px; }
    .primary { border: none; border-radius: 6px; padding: 9px 16px; background: #4f795d; color: #fff; font-weight: 750; cursor: pointer; }
    .block-add { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 4px 0 10px; }
    .block-add input { padding: 7px; border: 1px solid #cfc7b8; border-radius: 5px; font: inherit; }
    .block-add button { border: 1px solid #cfc7b8; border-radius: 6px; padding: 8px 12px; background: #fff; cursor: pointer; font-weight: 700; }
    .block-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
    .block-list li { display: flex; justify-content: space-between; align-items: center; font-size: 0.86rem; padding: 6px 10px; background: #f4f1ea; border-radius: 6px; }
    .block-list button { border: none; background: transparent; color: #7a2d1f; cursor: pointer; font-weight: 700; }
    .muted { color: #8a8577; }
    .week {
      max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;
    }
    .col {
      background: #fffdf8; border: 1px solid #d8d1c2; border-radius: 8px; padding: 8px; min-height: 140px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .col.today { border-color: #4f795d; box-shadow: 0 0 0 1px #4f795d; }
    .col-head { display: flex; justify-content: space-between; align-items: baseline; }
    .col-head strong { font-size: 0.9rem; }
    .col-head small { color: #8a8577; font-size: 0.75rem; }
    .col-hours { font-size: 0.72rem; color: #4f795d; font-weight: 700; }
    .col-hours.closed { color: #a89f8c; }
    .block { font-size: 0.74rem; background: #efe6d6; color: #7d5a25; border-radius: 5px; padding: 4px 6px; }
    .appt {
      display: grid; gap: 1px; text-align: left; border: none; border-left: 3px solid #4f795d;
      background: #eef3ee; border-radius: 5px; padding: 6px 8px; cursor: pointer; font: inherit;
    }
    .appt[data-status='PROPOSED'] { border-left-color: #b18b52; background: #f7efe1; }
    .appt[data-status='CANCELLED'], .appt[data-status='NO_SHOW'] { border-left-color: #a89f8c; background: #f0ede5; opacity: 0.7; }
    .appt[data-status='COMPLETED'] { border-left-color: #2d5175; background: #e9eef4; }
    .appt .time { font-weight: 800; font-size: 0.82rem; }
    .appt .who { font-size: 0.82rem; }
    .appt .svc { font-size: 0.72rem; color: #667569; }
    .appt .badge { font-size: 0.68rem; color: #4f795d; font-weight: 700; }
    .empty { color: #cfc7b8; text-align: center; margin-top: 8px; }
    .loading, .error {
      max-width: 1180px; margin: 16px auto; padding: 14px 16px; border-radius: 8px; background: #fffdf8;
    }
    .error { background: #f7e6df; color: #7a2d1f; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(20,25,20,.45); display: flex; align-items: center;
      justify-content: center; padding: 20px; z-index: 50;
    }
    .modal { background: #fffdf8; border-radius: 10px; padding: 20px; max-width: 420px; width: 100%; display: grid; gap: 12px; }
    .modal-sub { color: #667569; font-size: 0.85rem; }
    .modal-status { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 0.9rem; }
    .modal-status select { padding: 8px; border: 1px solid #cfc7b8; border-radius: 6px; font: inherit; }
    @media (max-width: 900px) {
      .page { padding: 16px; }
      .week { grid-template-columns: 1fr; }
      .col { min-height: auto; }
    }
  `,
})
export class AdminAgendaComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  protected readonly weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  protected readonly statuses: AppointmentStatus[] = [
    'PROPOSED',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ];

  protected readonly availability = signal<Availability | null>(null);
  protected readonly appointments = signal<Appointment[]>([]);
  protected readonly weekStartUtc = signal<Date>(startOfPrWeek(new Date()));
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly showSettings = signal(false);
  protected readonly selected = signal<Appointment | null>(null);

  // Settings form models
  protected hoursForm = signal<DayHoursForm[]>(
    Array.from({ length: 7 }, () => ({ enabled: false, start: '08:00', end: '16:00' })),
  );
  protected visitMinutes = 60;
  protected blockDate = '';
  protected blockStart = '';
  protected blockEnd = '';
  protected blockReason = '';

  protected readonly weekLabel = computed(() => {
    const start = this.weekStartUtc();
    const startP = prParts(start);
    const endP = prParts(new Date(start.getTime() + 6 * 86_400_000));
    return `${startP.day}/${startP.mo + 1} – ${endP.day}/${endP.mo + 1}`;
  });

  protected readonly columns = computed<DayColumn[]>(() => {
    const start = this.weekStartUtc();
    const avail = this.availability();
    const appts = this.appointments();
    const todayP = prParts(new Date());
    const cols: DayColumn[] = [];
    for (let i = 0; i < 7; i++) {
      const dayUtc = new Date(start.getTime() + i * 86_400_000);
      const p = prParts(dayUtc);
      const windows = (avail?.windows ?? []).filter((w) => w.weekday === p.weekday);
      const hours =
        windows.length > 0
          ? windows.map((w) => `${hhmm(w.startMinute)}–${hhmm(w.endMinute)}`).join(', ')
          : 'Cerrado';
      const dayAppts = appts
        .filter((a) => {
          const ap = prParts(a.scheduledAt);
          return ap.y === p.y && ap.mo === p.mo && ap.day === p.day;
        })
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      const dayBlocks = (avail?.blocks ?? [])
        .filter((b) => {
          const bs = prParts(b.startAt);
          return bs.y === p.y && bs.mo === p.mo && bs.day === p.day;
        })
        .map((b) => ({ id: b.id, label: this.blockLabel(b.startAt, b.endAt) }));
      cols.push({
        label: WEEKDAYS[p.weekday],
        dateLabel: `${p.day}/${p.mo + 1}`,
        y: p.y,
        mo: p.mo,
        day: p.day,
        weekday: p.weekday,
        isToday: p.y === todayP.y && p.mo === todayP.mo && p.day === todayP.day,
        hours,
        blocks: dayBlocks,
        appointments: dayAppts,
      });
    }
    return cols;
  });

  ngOnInit(): void {
    void this.load();
  }

  protected prevWeek(): void {
    this.weekStartUtc.set(new Date(this.weekStartUtc().getTime() - 7 * 86_400_000));
    void this.load();
  }
  protected nextWeek(): void {
    this.weekStartUtc.set(new Date(this.weekStartUtc().getTime() + 7 * 86_400_000));
    void this.load();
  }
  protected thisWeek(): void {
    this.weekStartUtc.set(startOfPrWeek(new Date()));
    void this.load();
  }

  protected async saveHours(): Promise<void> {
    const windows = this.hoursForm()
      .map((d, weekday) => ({ d, weekday }))
      .filter((x) => x.d.enabled)
      .map((x) => ({
        weekday: x.weekday,
        startMinute: toMinutes(x.d.start),
        endMinute: toMinutes(x.d.end),
      }))
      .filter((w) => w.endMinute > w.startMinute);
    this.saving.set(true);
    this.error.set('');
    try {
      const a = await this.api.saveAvailability({ windows, defaultVisitMinutes: this.visitMinutes });
      this.availability.set(a);
    } catch {
      this.error.set('No se pudieron guardar los horarios.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async addBlock(): Promise<void> {
    if (!this.blockDate || !this.blockStart || !this.blockEnd) {
      this.error.set('Completa fecha, hora inicio y fin del bloqueo.');
      return;
    }
    const [y, mo, day] = this.blockDate.split('-').map(Number);
    const startUtc = prLocalToUtc(y, mo - 1, day, toMinutes(this.blockStart));
    const endUtc = prLocalToUtc(y, mo - 1, day, toMinutes(this.blockEnd));
    this.saving.set(true);
    this.error.set('');
    try {
      const a = await this.api.addBlock(
        startUtc.toISOString(),
        endUtc.toISOString(),
        this.blockReason || null,
      );
      this.availability.set(a);
      this.blockStart = '';
      this.blockEnd = '';
      this.blockReason = '';
    } catch {
      this.error.set('No se pudo añadir el bloqueo (¿fin después del inicio?).');
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeBlock(id: string): Promise<void> {
    this.saving.set(true);
    try {
      this.availability.set(await this.api.removeBlock(id));
    } catch {
      this.error.set('No se pudo quitar el bloqueo.');
    } finally {
      this.saving.set(false);
    }
  }

  protected select(appt: Appointment): void {
    this.selected.set(appt);
  }

  protected async changeStatus(appt: Appointment, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as AppointmentStatus;
    this.saving.set(true);
    try {
      const res = await this.api.updateAppointment(appt.id, { status });
      this.appointments.update((all) => all.map((a) => (a.id === appt.id ? res.appointment : a)));
      this.selected.set(res.appointment);
    } catch {
      this.error.set('No se pudo actualizar la cita.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await this.api.logout();
  }

  protected statusLabel(s: AppointmentStatus): string {
    return STATUS_LABEL[s];
  }

  protected serviceLabel(value: string | null | undefined): string {
    if (!value) return 'Servicio';
    return value
      .toLowerCase()
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }

  protected apptTime(appt: Appointment): string {
    return hhmm(prParts(appt.scheduledAt).minuteOfDay);
  }

  protected apptDayTime(appt: Appointment): string {
    const p = prParts(appt.scheduledAt);
    return `${WEEKDAYS[p.weekday]} ${p.day}/${p.mo + 1} · ${hhmm(p.minuteOfDay)}`;
  }

  protected blockLabel(startIso: string, endIso: string): string {
    const s = prParts(startIso);
    const e = prParts(endIso);
    return `${s.day}/${s.mo + 1} ${hhmm(s.minuteOfDay)}–${hhmm(e.minuteOfDay)}`;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const start = this.weekStartUtc();
    const end = new Date(start.getTime() + 7 * 86_400_000);
    try {
      const [avail, appts] = await Promise.all([
        this.api.availability(),
        this.api.appointments(start.toISOString(), end.toISOString()),
      ]);
      this.availability.set(avail);
      this.appointments.set(appts);
      this.syncHoursForm(avail);
    } catch {
      this.error.set('No se pudo cargar la agenda. Inicia sesión de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  private syncHoursForm(avail: Availability): void {
    const form: DayHoursForm[] = Array.from({ length: 7 }, () => ({
      enabled: false,
      start: '08:00',
      end: '16:00',
    }));
    for (const w of avail.windows) {
      form[w.weekday] = {
        enabled: true,
        start: fromMinutes(w.startMinute),
        end: fromMinutes(w.endMinute),
      };
    }
    this.hoursForm.set(form);
    this.visitMinutes = avail.settings.defaultVisitMinutes;
  }
}

function toMinutes(hhmmStr: string): number {
  const [h, m] = hhmmStr.split(':').map(Number);
  return h * 60 + (m || 0);
}
function fromMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** UTC instant of the most recent PR-local Sunday 00:00 relative to `now`. */
function startOfPrWeek(now: Date): Date {
  const p = prParts(now);
  const sundayMidnight = prLocalToUtc(p.y, p.mo, p.day, 0);
  return new Date(sundayMidnight.getTime() - p.weekday * 86_400_000);
}
