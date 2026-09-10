import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authServiceSpy: jasmine.SpyObj<Pick<AuthService, 'autenticado'>>;
  let router: Router;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['autenticado']);

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authServiceSpy }],
    });

    router = TestBed.inject(Router);
  });

  function ejecutarGuard() {
    return TestBed.runInInjectionContext(() => authGuard(undefined as never, undefined as never));
  }

  it('permite el acceso cuando el usuario está autenticado', () => {
    authServiceSpy.autenticado.and.returnValue(true);

    expect(ejecutarGuard()).toBeTrue();
  });

  it('redirige a /login cuando el usuario no está autenticado', () => {
    authServiceSpy.autenticado.and.returnValue(false);

    const resultado = ejecutarGuard() as UrlTree;

    expect(resultado instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(resultado)).toBe('/login');
  });
});
