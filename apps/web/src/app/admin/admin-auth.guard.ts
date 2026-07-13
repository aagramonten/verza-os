import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AdminApiService } from './admin-api.service';

export const adminAuthGuard: CanActivateFn = () => {
  const api = inject(AdminApiService);
  const router = inject(Router);
  return api.hasSession() || router.createUrlTree(['/admin/login']);
};
