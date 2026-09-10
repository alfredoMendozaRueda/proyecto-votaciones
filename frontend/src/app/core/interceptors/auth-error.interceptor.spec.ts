import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { authErrorInterceptor } from './auth-error.interceptor';

describe('authErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('redirige a /login cuando una petición a la API responde 401', () => {
    http.get('/api/partidos').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/partidos').flush('no autorizado', {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('no redirige cuando el propio login responde 401 (credenciales inválidas)', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });

    httpMock.expectOne('/api/auth/login').flush('credenciales inválidas', {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('no redirige ante otros códigos de error (p. ej. 500)', () => {
    http.get('/api/partidos').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/partidos').flush('error interno', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('propaga el error original para que el llamante pueda reaccionar', () => {
    let errorRecibido: unknown;
    http.get('/api/partidos').subscribe({ error: (err) => (errorRecibido = err) });

    httpMock.expectOne('/api/partidos').flush('no autorizado', {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(errorRecibido).toBeTruthy();
  });
});
