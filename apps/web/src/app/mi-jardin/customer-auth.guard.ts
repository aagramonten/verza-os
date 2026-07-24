import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { CustomerPortalApiService } from './customer-portal-api.service';

export const customerAuthGuard: CanActivateFn = async () => {
  const api = inject(CustomerPortalApiService);
  const router = inject(Router);

  if (!api.hasSession()) {
    return router.createUrlTree(['/mi-jardin/acceso']);
  }

  try {
    await api.loadCustomer();
    return true;
  } catch {
    // loadCustomer removes only sessions rejected with 401. A transient
    // network failure keeps the local session so the portal can offer retry.
    return api.hasSession() || router.createUrlTree(['/mi-jardin/acceso']);
  }
};
