import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AdminApiService, type Dashboard } from './admin-api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="dashboard">
      <header>
        <div>
          <p class="eyebrow">Verza OS</p>
          <h1>Financial Dashboard</h1>
          @if (dashboard(); as data) {
            <p class="period">{{ data.period.label }}</p>
          }
        </div>
        <button type="button" class="ghost" (click)="logout()">Sign out</button>
      </header>

      @if (dashboard(); as data) {
        <section class="hero-grid" aria-label="Owner goals">
          <article [class.met]="data.hero.quotesSentThisMonth.met">
            <span>Quotes sent</span>
            <strong>{{ data.hero.quotesSentThisMonth.value }}</strong>
            <small>Goal {{ data.hero.quotesSentThisMonth.goal }}</small>
          </article>
          <article [class.met]="data.hero.averageTicketCents.met">
            <span>Average ticket</span>
            <strong>{{ money(data.hero.averageTicketCents.value) }}</strong>
            <small>Goal {{ money(data.hero.averageTicketCents.goalCents) }}</small>
          </article>
          <article [class.met]="data.hero.netProfitPerProjectCents.met">
            <span>Net profit / project</span>
            <strong>{{ money(data.hero.netProfitPerProjectCents.value) }}</strong>
            <small>Goal {{ money(data.hero.netProfitPerProjectCents.goalCents) }}</small>
          </article>
        </section>

        <section class="metric-grid" aria-label="Financial summary">
          <article>
            <span>Contract revenue</span>
            <strong>{{ money(data.revenue.contractCents) }}</strong>
          </article>
          <article>
            <span>Collected</span>
            <strong>{{ money(data.revenue.collectedCents) }}</strong>
          </article>
          <article>
            <span>Outstanding</span>
            <strong>{{ money(data.revenue.outstandingCents) }}</strong>
          </article>
          <article>
            <span>Net profit</span>
            <strong>{{ money(data.profit.netCents) }}</strong>
          </article>
        </section>

        <section class="split">
          <article class="panel">
            <h2>This month</h2>
            <dl>
              <div><dt>Signed revenue</dt><dd>{{ money(data.thisMonth.contractSignedCents) }}</dd></div>
              <div><dt>Cash collected</dt><dd>{{ money(data.thisMonth.collectedCents) }}</dd></div>
              <div><dt>Costs</dt><dd>{{ money(data.thisMonth.costsCents) }}</dd></div>
              <div><dt>Quotes sent</dt><dd>{{ data.thisMonth.quotesSent }}</dd></div>
            </dl>
          </article>
          <article class="panel">
            <h2>Profitability</h2>
            <dl>
              <div><dt>Gross profit</dt><dd>{{ money(data.profit.grossCents) }}</dd></div>
              <div><dt>Gross margin</dt><dd>{{ percent(data.profit.grossMarginPct) }}</dd></div>
              <div><dt>Net margin</dt><dd>{{ percent(data.profit.netMarginPct) }}</dd></div>
              <div><dt>ROI</dt><dd>{{ percent(data.profit.roiPct) }}</dd></div>
            </dl>
          </article>
        </section>

        <section class="split">
          <article class="panel">
            <h2>Costs</h2>
            <dl>
              <div><dt>Project costs</dt><dd>{{ money(data.costs.projectCostsCents) }}</dd></div>
              <div><dt>Marketing</dt><dd>{{ money(data.costs.marketingSpendCents) }}</dd></div>
              <div><dt>Total costs</dt><dd>{{ money(data.costs.totalCents) }}</dd></div>
            </dl>
            <ul>
              @for (item of data.costs.breakdown; track item.category) {
                <li><span>{{ label(item.category) }}</span><strong>{{ money(item.amountCents) }}</strong></li>
              }
            </ul>
          </article>
          <article class="panel">
            <h2>Projects</h2>
            <dl>
              <div><dt>Active projects</dt><dd>{{ data.projects.total }}</dd></div>
              <div><dt>With contract</dt><dd>{{ data.projects.withContract }}</dd></div>
              <div><dt>Quoted revenue</dt><dd>{{ money(data.revenue.quotedCents) }}</dd></div>
            </dl>
            <ul>
              @for (row of data.projects.byStatus; track row.status) {
                <li><span>{{ label(row.status) }}</span><strong>{{ row.count }}</strong></li>
              }
            </ul>
          </article>
        </section>

        <section class="panel">
          <h2>Profit by service</h2>
          <div class="table">
            <div class="row head"><span>Service</span><span>Revenue</span><span>Costs</span><span>Profit</span></div>
            @for (row of data.profitByService; track row.serviceType) {
              <div class="row">
                <span>{{ label(row.serviceType || 'UNKNOWN') }}</span>
                <span>{{ money(row.contractCents) }}</span>
                <span>{{ money(row.costsCents) }}</span>
                <strong>{{ money(row.profitCents) }}</strong>
              </div>
            }
          </div>
        </section>
      } @else {
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        } @else {
          <p class="loading">Loading dashboard...</p>
        }
      }
    </main>
  `,
  styles: `
    .dashboard {
      min-height: 100dvh;
      padding: 24px;
      background: #f4f1ea;
      color: #17231d;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header, .hero-grid, .metric-grid, .split {
      display: grid;
      gap: 14px;
    }
    header {
      grid-template-columns: 1fr auto;
      align-items: start;
      margin: 0 auto 20px;
      max-width: 1120px;
    }
    h1, h2, p { margin: 0; }
    h1 { font-size: 1.8rem; }
    h2 { font-size: 1rem; }
    .eyebrow, .period { color: #617164; font-size: 0.82rem; font-weight: 750; }
    .ghost {
      border: 1px solid #cfc7b8;
      border-radius: 6px;
      padding: 10px 14px;
      background: #fffdf8;
      color: #23352c;
      font-weight: 750;
      cursor: pointer;
    }
    .hero-grid, .metric-grid, .split, .panel {
      max-width: 1120px;
      margin-inline: auto;
    }
    .hero-grid { grid-template-columns: repeat(3, 1fr); }
    .metric-grid { grid-template-columns: repeat(4, 1fr); margin-bottom: 14px; }
    .split { grid-template-columns: repeat(2, 1fr); margin-bottom: 14px; }
    article, .panel {
      border: 1px solid #d8d1c2;
      border-radius: 8px;
      background: #fffdf8;
      box-shadow: 0 10px 28px rgb(35 45 38 / 8%);
    }
    .hero-grid article, .metric-grid article { padding: 16px; }
    .hero-grid article { border-left: 5px solid #b18b52; }
    .hero-grid article.met { border-left-color: #4f795d; }
    .panel { padding: 18px; }
    article span, dt { color: #667569; font-size: 0.84rem; }
    article strong { display: block; margin-top: 8px; font-size: 1.35rem; }
    small { display: block; margin-top: 4px; color: #7a705f; }
    dl { display: grid; gap: 10px; margin: 14px 0 0; }
    dl div, li, .row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
    }
    dd { margin: 0; font-weight: 800; }
    ul { display: grid; gap: 9px; margin: 14px 0 0; padding: 0; list-style: none; }
    li strong { font-size: 0.95rem; margin: 0; }
    .table { display: grid; gap: 0; margin-top: 12px; overflow-x: auto; }
    .row {
      grid-template-columns: minmax(150px, 1fr) repeat(3, minmax(96px, auto));
      padding: 10px 0;
      border-top: 1px solid #ebe5d8;
    }
    .row.head { color: #657467; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; }
    .loading, .error {
      max-width: 1120px;
      margin: 18px auto;
      padding: 14px 16px;
      border-radius: 8px;
      background: #fffdf8;
    }
    .error { background: #f7e6df; color: #7a2d1f; }
    @media (max-width: 820px) {
      header, .hero-grid, .metric-grid, .split { grid-template-columns: 1fr; }
      .dashboard { padding: 16px; }
    }
  `,
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  protected readonly dashboard = signal<Dashboard | null>(null);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.load();
  }

  protected async logout(): Promise<void> {
    await this.api.logout();
  }

  protected money(value: number | null): string {
    if (value === null) {
      return '—';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value / 100);
  }

  protected percent(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}%`;
  }

  protected label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async load(): Promise<void> {
    try {
      this.dashboard.set(await this.api.dashboard());
    } catch {
      this.error.set('Unable to load the dashboard. Sign in again and retry.');
    }
  }
}
