import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Redirige al login cuando una peticion a la API falla con 401: la sesion
 * ha caducado o nunca llego a existir para esta pestaña.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.startsWith('/api/auth/')) {
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
