import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard, roleGuard } from './core/guards/role.guard';
import { AuthenticatedLayout } from './shared/layout/authenticated-layout';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login)
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/registro/registro').then((m) => m.Registro)
  },
  {
    path: 'despedida',
    loadComponent: () => import('./features/despedida/despedida').then((m) => m.Despedida)
  },
  {
    path: '',
    component: AuthenticatedLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'admin/panel',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/admin/panel/admin-panel').then((m) => m.AdminPanel)
      },
      {
        path: 'admin/partidos',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'analista'] },
        loadComponent: () => import('./features/admin/partidos/admin-partidos').then((m) => m.AdminPartidos)
      },
      {
        path: 'admin/candidatos',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'analista'] },
        loadComponent: () => import('./features/admin/candidatos/admin-candidatos').then((m) => m.AdminCandidatos)
      },
      {
        path: 'admin/censo',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/admin/censo/admin-censo').then((m) => m.AdminCenso)
      },
      {
        path: 'admin/elecciones',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/admin/elecciones/admin-elecciones').then((m) => m.AdminElecciones)
      },
      {
        path: 'analista/panel',
        canActivate: [roleGuard],
        data: { roles: ['analista'] },
        loadComponent: () => import('./features/analista/panel/analista-panel').then((m) => m.AnalistaPanel)
      },
      {
        path: 'analista/partidos/comprobar',
        canActivate: [roleGuard],
        data: { roles: ['analista'] },
        loadComponent: () =>
          import('./features/analista/comprobar-partidos/comprobar-partidos').then((m) => m.ComprobarPartidos)
      },
      {
        path: 'analista/candidatos',
        canActivate: [roleGuard],
        data: { roles: ['analista'] },
        loadComponent: () =>
          import('./features/analista/candidatos-localidad/candidatos-localidad').then((m) => m.CandidatosLocalidad)
      },
      {
        path: 'analista/porcentajes',
        canActivate: [roleGuard],
        data: { roles: ['analista'] },
        loadComponent: () => import('./features/analista/porcentajes/porcentajes').then((m) => m.Porcentajes)
      },
      {
        path: 'analista/cookie',
        canActivate: [roleGuard],
        data: { roles: ['analista'] },
        loadComponent: () => import('./features/analista/cookie/cookie-ganador').then((m) => m.CookieGanador)
      },
      {
        path: 'usuario/panel',
        canActivate: [roleGuard],
        data: { roles: ['votante'] },
        loadComponent: () => import('./features/votante/panel/votante-panel').then((m) => m.VotantePanel)
      },
      {
        path: 'votacion',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'votante'] },
        loadComponent: () => import('./features/votacion/votacion').then((m) => m.Votacion)
      },
      {
        path: 'resultados',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'votante'] },
        loadComponent: () => import('./features/resultados/resultados').then((m) => m.Resultados)
      },
      {
        path: 'ganador',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'votante'] },
        loadComponent: () => import('./features/ganador/ganador').then((m) => m.Ganador)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
