import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { UsuarioActual } from '../models/usuario.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const usuario: UsuarioActual = { dni: '12345678Z', rol: 'admin' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('empieza sin usuario autenticado', () => {
    expect(service.usuario()).toBeNull();
    expect(service.autenticado()).toBeFalse();
  });

  it('cargarSesion() guarda el usuario cuando la API responde con éxito', () => {
    service.cargarSesion().subscribe();

    const req = httpMock.expectOne('/api/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush(usuario);

    expect(service.usuario()).toEqual(usuario);
    expect(service.autenticado()).toBeTrue();
    expect(service.cargando()).toBeFalse();
  });

  it('cargarSesion() deja el usuario en null cuando la API falla (401)', () => {
    service.cargarSesion().subscribe();

    const req = httpMock.expectOne('/api/auth/me');
    req.flush('no autenticado', { status: 401, statusText: 'Unauthorized' });

    expect(service.usuario()).toBeNull();
    expect(service.autenticado()).toBeFalse();
    expect(service.cargando()).toBeFalse();
  });

  it('login() guarda el usuario devuelto por la API', () => {
    service.login('12345678Z', 'secreto').subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dni: '12345678Z', contrasena: 'secreto' });
    req.flush(usuario);

    expect(service.usuario()).toEqual(usuario);
    expect(service.autenticado()).toBeTrue();
  });

  it('logout() limpia el usuario tras la respuesta de la API', () => {
    service.login('12345678Z', 'secreto').subscribe();
    httpMock.expectOne('/api/auth/login').flush(usuario);
    expect(service.autenticado()).toBeTrue();

    service.logout().subscribe();
    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(null);

    expect(service.usuario()).toBeNull();
    expect(service.autenticado()).toBeFalse();
  });

  it('tieneRol() comprueba el rol del usuario actual', () => {
    expect(service.tieneRol('admin', 'analista')).toBeFalse();

    service.login('12345678Z', 'secreto').subscribe();
    httpMock.expectOne('/api/auth/login').flush(usuario);

    expect(service.tieneRol('admin')).toBeTrue();
    expect(service.tieneRol('analista', 'votante')).toBeFalse();
  });

  it('rutaPanelSegunRol() devuelve el panel correcto según el rol', () => {
    expect(service.rutaPanelSegunRol()).toBe('/login');

    const casos: [string, string][] = [
      ['admin', '/admin/panel'],
      ['analista', '/analista/panel'],
      ['votante', '/usuario/panel'],
    ];

    for (const [rol, rutaEsperada] of casos) {
      service.login('12345678Z', 'secreto').subscribe();
      httpMock.expectOne('/api/auth/login').flush({ dni: '12345678Z', rol });
      expect(service.rutaPanelSegunRol()).toBe(rutaEsperada);
    }
  });
});
