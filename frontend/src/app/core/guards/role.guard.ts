import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Restringe una ruta a los roles indicados en `route.data['roles']`.
 * Requiere que `authGuard` se ejecute antes en la misma cadena (para
 * garantizar que el usuario ya esta autenticado).
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const rolesPermitidos = (route.data['roles'] as string[] | undefined) ?? [];
  if (authService.tieneRol(...rolesPermitidos)) {
    return true;
  }
  return router.createUrlTree([authService.rutaPanelSegunRol()]);
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.autenticado()) {
    return true;
  }
  return router.createUrlTree([authService.rutaPanelSegunRol()]);
};
