import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CustomerPortalApiService } from './customer-portal-api.service';
import { CustomerVerifyComponent } from './customer-verify.component';

describe('CustomerVerifyComponent', () => {
  let api: jasmine.SpyObj<CustomerPortalApiService>;
  let router: Router;
  let replaceState: jasmine.Spy;

  beforeEach(async () => {
    api = jasmine.createSpyObj<CustomerPortalApiService>('CustomerPortalApiService', [
      'verifyAccess',
      'clearSession',
    ]);
    await TestBed.configureTestingModule({
      imports: [CustomerVerifyComponent],
      providers: [
        provideRouter([]),
        { provide: CustomerPortalApiService, useValue: api },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    replaceState = spyOn(window.history, 'replaceState').and.callThrough();
  });

  afterEach(() => {
    window.history.replaceState(window.history.state, '', '/');
  });

  it('removes the magic token fragment before verifying it', fakeAsync(() => {
    window.history.replaceState(window.history.state, '', '/mi-jardin/verificar#token=one-use-token');
    replaceState.calls.reset();
    api.verifyAccess.and.resolveTo({
      name: 'Ana Rivera',
      phone: null,
      email: 'ana@example.com',
      municipality: 'Caguas',
    });

    const fixture = TestBed.createComponent(CustomerVerifyComponent);
    fixture.detectChanges();

    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      '',
      '/mi-jardin/verificar',
    );
    expect(window.location.hash).toBe('');
    expect(api.verifyAccess).toHaveBeenCalledWith('one-use-token');

    tick();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/mi-jardin', { replaceUrl: true });
  }));

  it('shows a safe error when the link does not contain a token', () => {
    window.history.replaceState(window.history.state, '', '/mi-jardin/verificar');
    replaceState.calls.reset();

    const fixture = TestBed.createComponent(CustomerVerifyComponent);
    fixture.detectChanges();

    expect(api.verifyAccess).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Solicita uno nuevo');
    expect(window.location.hash).toBe('');
  });
});
