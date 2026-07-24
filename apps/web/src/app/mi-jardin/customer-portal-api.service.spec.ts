import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CustomerPortalApiService, type CustomerPortalCustomer } from './customer-portal-api.service';

describe('CustomerPortalApiService', () => {
  let service: CustomerPortalApiService;
  let http: HttpTestingController;

  const customer: CustomerPortalCustomer = {
    name: 'Ana Rivera',
    phone: '+17875550123',
    email: 'ana@example.com',
    municipality: 'Caguas',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(CustomerPortalApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('requests a magic link using the customer email', async () => {
    const pending = service.requestAccess('  ana@example.com ');
    const request = http.expectOne('/api/v1/mi-jardin/auth/request');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ identifier: 'ana@example.com' });
    request.flush({ message: 'Si encontramos una cuenta, enviaremos un enlace de acceso.' });

    await expectAsync(pending).toBeResolved();
  });

  it('persists a verified customer session separately from admin auth', async () => {
    localStorage.setItem('verza.admin.accessToken', 'admin-token');
    const pending = service.verifyAccess('magic-token');
    const request = http.expectOne('/api/v1/mi-jardin/auth/verify');

    request.flush({
      sessionToken: 'customer-session',
      expiresAt: futureIso(),
      customer,
    });

    await expectAsync(pending).toBeResolvedTo(customer);
    expect(service.hasSession()).toBeTrue();
    expect(service.customer()).toEqual(customer);

    service.clearSession();
    expect(service.hasSession()).toBeFalse();
    expect(localStorage.getItem('verza.admin.accessToken')).toBe('admin-token');
  });

  it('uses the customer bearer session to load only the portal project DTO', async () => {
    await establishSession(service, http, customer);

    const pending = service.projects();
    const request = http.expectOne('/api/v1/mi-jardin/projects');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer customer-session');
    request.flush({
      items: [
        {
          referenceNumber: 'VGP-0007',
          title: 'Patio tropical',
          serviceType: 'DESIGN_INSTALLATION',
          status: 'IN_PROGRESS',
          contractSignedAt: '2026-07-01T12:00:00.000Z',
          startedAt: '2026-07-20T12:00:00.000Z',
          completedAt: null,
        },
      ],
    });

    const projects = await pending;
    expect(projects.length).toBe(1);
    expect(projects[0]?.referenceNumber).toBe('VGP-0007');
  });

  it('removes the local session when a protected endpoint returns 401', async () => {
    await establishSession(service, http, customer);

    const pending = service.projects();
    http
      .expectOne('/api/v1/mi-jardin/projects')
      .flush(
        { type: 'about:blank', title: 'Unauthorized', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expectAsync(pending).toBeRejected();
    expect(service.hasSession()).toBeFalse();
    expect(service.customer()).toBeNull();
  });

  it('rejects an already-expired session returned by verification', async () => {
    const pending = service.verifyAccess('magic-token');
    http.expectOne('/api/v1/mi-jardin/auth/verify').flush({
      sessionToken: 'expired-session',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      customer,
    });

    await expectAsync(pending).toBeRejected();
    expect(service.hasSession()).toBeFalse();
  });

  it('revokes the server session on logout and always removes it locally', async () => {
    await establishSession(service, http, customer);

    const pending = service.logout();
    const request = http.expectOne('/api/v1/mi-jardin/auth/logout');
    expect(request.request.headers.get('Authorization')).toBe('Bearer customer-session');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expectAsync(pending).toBeResolved();
    expect(service.hasSession()).toBeFalse();
  });
});

async function establishSession(
  service: CustomerPortalApiService,
  http: HttpTestingController,
  customer: CustomerPortalCustomer,
): Promise<void> {
  const pending = service.verifyAccess('magic-token');
  http.expectOne('/api/v1/mi-jardin/auth/verify').flush({
    sessionToken: 'customer-session',
    expiresAt: futureIso(),
    customer,
  });
  await pending;
}

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}
