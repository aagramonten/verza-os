import { Routes } from '@angular/router';
import { adminAuthGuard } from './admin/admin-auth.guard';

export const routes: Routes = [
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./admin/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
  },
  {
    path: 'cotizar',
    loadComponent: () => import('./cotizar/cotizar.component').then((m) => m.CotizarComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'cotizar' },
  { path: '**', redirectTo: 'cotizar' },
];
