import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'cotizar',
    loadComponent: () => import('./cotizar/cotizar.component').then((m) => m.CotizarComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'cotizar' },
  { path: '**', redirectTo: 'cotizar' },
];
