import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { customerAuthGuard } from './customer-auth.guard';
import { CustomerPortalApiService } from './customer-portal-api.service';

describe('customerAuthGuard', () => {
  let api: jasmine.SpyObj<CustomerPortalApiService>;
  let router: Router;

  beforeEach(() => {
    api = jasmine.createSpyObj<CustomerPortalApiService>('CustomerPortalApiService', [
      'hasSession',
      'loadCustomer',
      'clearSession',
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CustomerPortalApiService, useValue: api },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('redirects customers without a local session to the access page', async () => {
    api.hasSession.and.returnValue(false);

    const result = await runGuard();

    expect(result).not.toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/mi-jardin/acceso');
    expect(api.loadCustomer).not.toHaveBeenCalled();
  });

  it('allows a session only after the server validates it', async () => {
    api.hasSession.and.returnValue(true);
    api.loadCustomer.and.resolveTo({
      name: 'Ana Rivera',
      phone: null,
      email: 'ana@example.com',
      municipality: 'Caguas',
    });

    await expectAsync(runGuard()).toBeResolvedTo(true);
    expect(api.loadCustomer).toHaveBeenCalled();
  });

  it('clears and redirects a session rejected by the server', async () => {
    api.hasSession.and.returnValues(true, false);
    api.loadCustomer.and.rejectWith(new Error('Unauthorized'));

    const result = await runGuard();

    expect(router.serializeUrl(result as UrlTree)).toBe('/mi-jardin/acceso');
  });

  it('keeps a valid local session during a transient network failure', async () => {
    api.hasSession.and.returnValue(true);
    api.loadCustomer.and.rejectWith(new Error('Network unavailable'));

    await expectAsync(runGuard()).toBeResolvedTo(true);
    expect(api.clearSession).not.toHaveBeenCalled();
  });
});

function runGuard(): Promise<true | UrlTree> {
  return TestBed.runInInjectionContext(
    () => customerAuthGuard({} as never, {} as never) as Promise<true | UrlTree>,
  );
}
