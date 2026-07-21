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
    path: 'admin/leads',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./admin/admin-leads.component').then((m) => m.AdminLeadsComponent),
  },
  {
    path: 'admin/agenda',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./admin/admin-agenda.component').then((m) => m.AdminAgendaComponent),
  },
  {
    path: 'cotizar',
    loadComponent: () => import('./cotizar/cotizar.component').then((m) => m.CotizarComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'cotizar' },
  { path: '**', redirectTo: 'cotizar' },
];
