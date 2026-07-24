import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export type UserRole = 'OWNER' | 'ADMIN';

export interface AdminUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthResult {
  accessToken: string;
  expiresInSec: number;
  refreshToken: string;
  user: AdminUser;
}

export interface Dashboard {
  currency: string;
  period: { label: string; start: string; end: string };
  revenue: {
    quotedCents: number;
    contractCents: number;
    collectedCents: number;
    outstandingCents: number;
  };
  thisMonth: {
    contractSignedCents: number;
    collectedCents: number;
    costsCents: number;
    quotesSent: number;
  };
  costs: {
    projectCostsCents: number;
    marketingSpendCents: number;
    totalCents: number;
    breakdown: Array<{ category: string; amountCents: number }>;
  };
  profit: {
    grossCents: number;
    netCents: number;
    grossMarginPct: number | null;
    netMarginPct: number | null;
    averagePerProjectCents: number | null;
    roiPct: number | null;
  };
  averages: { ticketCents: number | null };
  projects: {
    total: number;
    withContract: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  profitByService: Array<{
    serviceType: string | null;
    contractCents: number;
    costsCents: number;
    profitCents: number;
    projectCount: number;
  }>;
  marketing: {
    totalCents: number;
    costPerLeadCents: number | null;
    costPerWonCustomerCents: number | null;
  };
  leads: { total: number };
  hero: {
    quotesSentThisMonth: { value: number; goal: number; met: boolean };
    averageTicketCents: { value: number | null; goalCents: number; met: boolean };
    netProfitPerProjectCents: { value: number | null; goalCents: number; met: boolean };
  };
}

export type FollowUpStatus = 'NEW' | 'CONTACTED' | 'IN_FOLLOW_UP' | 'CLOSED';

export interface LeadCustomer {
  name: string | null;
  phone: string | null;
  email: string | null;
  municipality: string | null;
}

export interface LeadListItem {
  id: string;
  referenceNumber: string;
  status: string;
  followUpStatus: FollowUpStatus;
  serviceType: string | null;
  description: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  customer: LeadCustomer | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDetail extends LeadListItem {
  desiredDate: string | null;
  preferredVisitTime: string | null;
  adminSummary: { lines?: Array<{ label: string; value: string }> } | null;
  collectedData: {
    fields: Record<string, unknown>;
    confirmed: string[];
  } | null;
  leadScore: number | null;
  conversionBand: string | null;
  suggestedNextAction: string | null;
  photoCount: number;
}

export interface LeadPage {
  items: LeadListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProjectSummary {
  id: string;
  referenceNumber: string;
  title: string | null;
  status: string;
  currency: string;
  contractAmountCents: number | null;
  customerId: string | null;
}

export interface QuoteLineItem {
  description: string;
  quantityMilli: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OfficialQuote {
  id: string;
  projectId: string;
  version: number;
  status: string;
  currency: string;
  lineItems: QuoteLineItem[];
  subtotalCents: number;
  taxRateBps: number | null;
  taxCents: number;
  totalCents: number;
  validUntil: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotePage {
  items: OfficialQuote[];
  total: number;
  limit: number;
  offset: number;
}

// ── Scheduling / agenda ────────────────────────────────────────────

export type AppointmentStatus = 'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface AvailabilityWindow {
  weekday: number; // 0=Sun..6=Sat
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityBlock {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface Availability {
  windows: AvailabilityWindow[];
  blocks: AvailabilityBlock[];
  settings: { defaultVisitMinutes: number; slotMinutes: number };
}

export interface Appointment {
  id: string;
  leadId: string;
  scheduledAt: string;
  durationMin: number;
  status: AppointmentStatus;
  locationText: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    referenceNumber: string;
    customerName: string | null;
    customerPhone: string | null;
    municipality: string | null;
    serviceType: string | null;
  } | null;
}

export interface Slot {
  startAt: string;
  endAt: string;
  free: boolean;
}

export interface Conflict {
  kind: 'appointment' | 'block' | 'outside-hours';
  startAt: string;
  endAt: string;
}

export interface AppointmentResult {
  appointment: Appointment;
  conflicts: Conflict[];
}

const ACCESS_KEY = 'verza.admin.accessToken';
const REFRESH_KEY = 'verza.admin.refreshToken';
const USER_KEY = 'verza.admin.user';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private refreshInFlight: Promise<void> | null = null;

  get user(): AdminUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AdminUser;
    } catch {
      this.clearSession();
      return null;
    }
  }

  hasSession(): boolean {
    return Boolean(localStorage.getItem(ACCESS_KEY) || localStorage.getItem(REFRESH_KEY));
  }

  async login(email: string, password: string): Promise<AdminUser> {
    const result = await firstValueFrom(
      this.http.post<AuthResult>('/api/v1/auth/login', { email, password }),
    );
    this.storeSession(result);
    return result.user;
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    this.clearSession();
    if (refreshToken) {
      await firstValueFrom(this.http.post('/api/v1/auth/logout', { refreshToken })).catch(() => null);
    }
    await this.router.navigateByUrl('/admin/login');
  }

  async dashboard(): Promise<Dashboard> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.get<Dashboard>('/api/v1/dashboard/financials', { headers })),
    );
  }

  async leads(followUpStatus?: FollowUpStatus): Promise<LeadPage> {
    const query = followUpStatus ? `?followUpStatus=${followUpStatus}` : '';
    return this.withAuth((headers) =>
      firstValueFrom(this.http.get<LeadPage>(`/api/v1/leads${query}`, { headers })),
    );
  }

  async leadDetail(id: string): Promise<LeadDetail> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.get<LeadDetail>(`/api/v1/leads/${id}`, { headers })),
    );
  }

  async projects(): Promise<{ items: ProjectSummary[]; total: number }> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.get<{ items: ProjectSummary[]; total: number }>('/api/v1/projects', { headers })),
    );
  }

  async quotes(projectId: string): Promise<QuotePage> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.get<QuotePage>(`/api/v1/projects/${projectId}/quotes`, { headers })),
    );
  }

  async createQuote(projectId: string, input: {
    currency: string;
    lineItems: Array<{ description: string; quantityMilli: number; unitPriceCents: number }>;
    taxRateBps?: number | null;
    validUntil?: string | null;
    notes?: string | null;
  }): Promise<OfficialQuote> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.post<OfficialQuote>(`/api/v1/projects/${projectId}/quotes`, input, { headers })),
    );
  }

  async quoteAction(projectId: string, quoteId: string, action: 'submit' | 'approve' | 'send'): Promise<OfficialQuote> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.post<OfficialQuote>(`/api/v1/projects/${projectId}/quotes/${quoteId}/${action}`, {}, { headers })),
    );
  }

  async updateLeadFollowUp(id: string, followUpStatus: FollowUpStatus): Promise<LeadDetail> {
    return this.withAuth((headers) =>
      firstValueFrom(
        this.http.patch<LeadDetail>(`/api/v1/leads/${id}`, { followUpStatus }, { headers }),
      ),
    );
  }

  // ── Scheduling ─────────────────────────────────────────────────────

  async availability(): Promise<Availability> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.get<Availability>('/api/v1/availability', { headers })),
    );
  }

  async saveAvailability(input: {
    windows: AvailabilityWindow[];
    defaultVisitMinutes?: number;
    slotMinutes?: number;
  }): Promise<Availability> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.put<Availability>('/api/v1/availability', input, { headers })),
    );
  }

  async addBlock(startAt: string, endAt: string, reason: string | null): Promise<Availability> {
    return this.withAuth((headers) =>
      firstValueFrom(
        this.http.post<Availability>(
          '/api/v1/availability/blocks',
          { startAt, endAt, reason },
          { headers },
        ),
      ),
    );
  }

  async removeBlock(id: string): Promise<Availability> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.delete<Availability>(`/api/v1/availability/blocks/${id}`, { headers })),
    );
  }

  async appointments(fromIso: string, toIso: string): Promise<Appointment[]> {
    return this.withAuth((headers) =>
      firstValueFrom(
        this.http.get<Appointment[]>(
          `/api/v1/appointments?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
          { headers },
        ),
      ),
    );
  }

  async slots(fromIso: string, toIso: string): Promise<Slot[]> {
    return this.withAuth((headers) =>
      firstValueFrom(
        this.http.get<Slot[]>(
          `/api/v1/availability/slots?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
          { headers },
        ),
      ),
    );
  }

  async createAppointment(input: {
    leadId: string;
    scheduledAt: string;
    durationMin?: number;
    notes?: string | null;
  }): Promise<AppointmentResult> {
    return this.withAuth((headers) =>
      firstValueFrom(this.http.post<AppointmentResult>('/api/v1/appointments', input, { headers })),
    );
  }

  async updateAppointment(
    id: string,
    input: { scheduledAt?: string; status?: AppointmentStatus; notes?: string | null },
  ): Promise<AppointmentResult> {
    return this.withAuth((headers) =>
      firstValueFrom(
        this.http.patch<AppointmentResult>(`/api/v1/appointments/${id}`, input, { headers }),
      ),
    );
  }

  private async withAuth<T>(request: (headers: HttpHeaders) => Promise<T>): Promise<T> {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    if (!accessToken) {
      await this.refresh();
    }
    try {
      return await request(this.authHeaders());
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        await this.refresh();
        return request(this.authHeaders());
      }
      throw error;
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.performRefresh();
    try {
      await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private async performRefresh(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      this.clearSession();
      throw new Error('Authentication required');
    }
    try {
      const result = await firstValueFrom(
        this.http.post<AuthResult>('/api/v1/auth/refresh', { refreshToken }),
      );
      this.storeSession(result);
    } catch {
      this.clearSession();
      throw new Error('Authentication required');
    }
  }

  private authHeaders(): HttpHeaders {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    if (!accessToken) {
      throw new Error('Authentication required');
    }
    return new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
  }

  private storeSession(result: AuthResult): void {
    localStorage.setItem(ACCESS_KEY, result.accessToken);
    localStorage.setItem(REFRESH_KEY, result.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  }

  private clearSession(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 401;
}
