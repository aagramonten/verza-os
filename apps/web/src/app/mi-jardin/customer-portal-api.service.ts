import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface CustomerPortalCustomer {
  name: string | null;
  phone: string | null;
  email: string | null;
  municipality: string | null;
}

export type CustomerProjectStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

export type CustomerProjectServiceType =
  | 'DESIGN_INSTALLATION'
  | 'LAWN'
  | 'IRRIGATION'
  | 'LIGHTING'
  | 'PLANTING'
  | 'CLEANUP'
  | 'MAINTENANCE'
  | 'OTHER';

export interface CustomerPortalProject {
  referenceNumber: string;
  title: string | null;
  serviceType: CustomerProjectServiceType | null;
  status: CustomerProjectStatus;
  contractSignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface RequestAccessResponse {
  message: string;
}

interface VerifyAccessResponse {
  sessionToken: string;
  expiresAt: string;
  customer: CustomerPortalCustomer;
}

interface MeResponse {
  customer: CustomerPortalCustomer;
}

interface ProjectsResponse {
  items: CustomerPortalProject[];
}

interface StoredCustomerSession {
  token: string;
  expiresAt: string;
}

const SESSION_KEY = 'verza.customer.session';

@Injectable({ providedIn: 'root' })
export class CustomerPortalApiService {
  private readonly http = inject(HttpClient);
  private readonly currentCustomer = signal<CustomerPortalCustomer | null>(null);

  readonly customer = this.currentCustomer.asReadonly();

  hasSession(): boolean {
    return this.readSession() !== null;
  }

  async requestAccess(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post<RequestAccessResponse>('/api/v1/mi-jardin/auth/request', {
        identifier: email.trim(),
      }),
    );
  }

  async verifyAccess(token: string): Promise<CustomerPortalCustomer> {
    const result = await firstValueFrom(
      this.http.post<VerifyAccessResponse>('/api/v1/mi-jardin/auth/verify', {
        token: token.trim(),
      }),
    );
    this.storeSession(result.sessionToken, result.expiresAt);
    this.currentCustomer.set(result.customer);
    return result.customer;
  }

  async loadCustomer(): Promise<CustomerPortalCustomer> {
    const result = await this.withSession((headers) =>
      firstValueFrom(
        this.http.get<MeResponse>('/api/v1/mi-jardin/auth/me', {
          headers,
        }),
      ),
    );
    this.currentCustomer.set(result.customer);
    return result.customer;
  }

  async projects(): Promise<CustomerPortalProject[]> {
    const result = await this.withSession((headers) =>
      firstValueFrom(
        this.http.get<ProjectsResponse>('/api/v1/mi-jardin/projects', {
          headers,
        }),
      ),
    );
    return result.items;
  }

  async logout(): Promise<void> {
    const stored = this.readSession();
    try {
      if (stored !== null) {
        await firstValueFrom(
          this.http.post(
            '/api/v1/mi-jardin/auth/logout',
            {},
            { headers: this.headersFor(stored.token) },
          ),
        );
      }
    } finally {
      this.clearSession();
    }
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
    this.currentCustomer.set(null);
  }

  private async withSession<T>(request: (headers: HttpHeaders) => Promise<T>): Promise<T> {
    const stored = this.readSession();
    if (stored === null) {
      throw new Error('Customer authentication required');
    }
    try {
      return await request(this.headersFor(stored.token));
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        this.clearSession();
      }
      throw error;
    }
  }

  private headersFor(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private storeSession(token: string, expiresAt: string): void {
    const expiration = Date.parse(expiresAt);
    if (!token || !Number.isFinite(expiration) || expiration <= Date.now()) {
      this.clearSession();
      throw new Error('Invalid customer session');
    }
    const stored: StoredCustomerSession = { token, expiresAt };
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  }

  private readSession(): StoredCustomerSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    try {
      const value: unknown = JSON.parse(raw);
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as StoredCustomerSession).token === 'string' &&
        typeof (value as StoredCustomerSession).expiresAt === 'string' &&
        Date.parse((value as StoredCustomerSession).expiresAt) > Date.now()
      ) {
        return value as StoredCustomerSession;
      }
    } catch {
      // Invalid or expired sessions are removed below.
    }
    this.clearSession();
    return null;
  }
}

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 401;
}
