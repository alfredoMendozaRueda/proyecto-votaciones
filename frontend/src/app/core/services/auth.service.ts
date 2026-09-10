import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, tap } from 'rxjs';

import { UsuarioActual } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly usuarioSignal = signal<UsuarioActual | null>(null);
  private readonly cargandoSignal = signal(true);

  readonly usuario = this.usuarioSignal.asReadonly();
  readonly cargando = this.cargandoSignal.asReadonly();
  readonly autenticado = computed(() => this.usuarioSignal() !== null);

  cargarSesion(): Observable<UsuarioActual | null> {
    return this.http.get<UsuarioActual>('/api/auth/me').pipe(
      tap((usuario) => this.usuarioSignal.set(usuario)),
      catchError(() => {
        this.usuarioSignal.set(null);
        return of(null);
      }),
      finalize(() => this.cargandoSignal.set(false)),
    );
  }

  login(dni: string, contrasena: string): Observable<UsuarioActual> {
    return this.http
      .post<UsuarioActual>('/api/auth/login', { dni, contrasena })
      .pipe(tap((usuario) => this.usuarioSignal.set(usuario)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>('/api/auth/logout', {})
      .pipe(tap(() => this.usuarioSignal.set(null)));
  }

  tieneRol(...roles: string[]): boolean {
    const usuario = this.usuarioSignal();
    return usuario !== null && roles.includes(usuario.rol);
  }

  rutaPanelSegunRol(): string {
    switch (this.usuarioSignal()?.rol) {
      case 'admin':
        return '/admin/panel';
      case 'analista':
        return '/analista/panel';
      case 'votante':
        return '/usuario/panel';
      default:
        return '/login';
    }
  }
}
