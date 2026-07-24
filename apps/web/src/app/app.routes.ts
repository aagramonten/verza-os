import { Routes } from '@angular/router';
import { adminAuthGuard } from './admin/admin-auth.guard';
import { customerAuthGuard } from './mi-jardin/customer-auth.guard';

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
    path: 'admin/cotizaciones',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./admin/admin-quotes.component').then((m) => m.AdminQuotesComponent),
  },
  {
    path: 'cotizar',
    loadComponent: () => import('./cotizar/cotizar.component').then((m) => m.CotizarComponent),
  },
  {
    path: 'mi-jardin/acceso',
    loadComponent: () =>
      import('./mi-jardin/customer-access.component').then((m) => m.CustomerAccessComponent),
  },
  {
    path: 'mi-jardin/verificar',
    loadComponent: () =>
      import('./mi-jardin/customer-verify.component').then((m) => m.CustomerVerifyComponent),
  },
  {
    path: 'mi-jardin',
    canActivate: [customerAuthGuard],
    loadComponent: () =>
      import('./mi-jardin/customer-portal.component').then((m) => m.CustomerPortalComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'cotizar' },
  { path: '**', redirectTo: 'cotizar' },
];
