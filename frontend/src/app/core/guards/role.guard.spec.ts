import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';

import { guestGuard, roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

describe('roleGuard / guestGuard', () => {
  let authServiceSpy: jasmine.SpyObj<
    Pick<AuthService, 'autenticado' | 'tieneRol' | 'rutaPanelSegunRol'>
  >;
  let router: Router;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'autenticado',
      'tieneRol',
      'rutaPanelSegunRol',
    ]);

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authServiceSpy }],
    });

    router = TestBed.inject(Router);
  });

  function rutaConRoles(roles: string[] | undefined): ActivatedRouteSnapshot {
    return { data: { roles } } as unknown as ActivatedRouteSnapshot;
  }

  describe('roleGuard', () => {
    it('permite el acceso cuando el usuario tiene uno de los roles permitidos', () => {
      authServiceSpy.tieneRol.and.returnValue(true);

      const resultado = TestBed.runInInjectionContext(() =>
        roleGuard(rutaConRoles(['admin']), undefined as never),
      );

      expect(resultado).toBeTrue();
      expect(authServiceSpy.tieneRol).toHaveBeenCalledWith('admin');
    });

    it('redirige al panel del usuario cuando no tiene el rol requerido', () => {
      authServiceSpy.tieneRol.and.returnValue(false);
      authServiceSpy.rutaPanelSegunRol.and.returnValue('/usuario/panel');

      const resultado = TestBed.runInInjectionContext(() =>
        roleGuard(rutaConRoles(['admin']), undefined as never),
      ) as UrlTree;

      expect(resultado instanceof UrlTree).toBeTrue();
      expect(router.serializeUrl(resultado)).toBe('/usuario/panel');
    });

    it('trata la ausencia de roles en la ruta como lista vacía', () => {
      authServiceSpy.tieneRol.and.returnValue(false);
      authServiceSpy.rutaPanelSegunRol.and.returnValue('/login');

      TestBed.runInInjectionContext(() => roleGuard(rutaConRoles(undefined), undefined as never));

      expect(authServiceSpy.tieneRol).toHaveBeenCalledWith();
    });
  });

  describe('guestGuard', () => {
    function ejecutarGuestGuard() {
      return TestBed.runInInjectionContext(() =>
        guestGuard(undefined as never, undefined as never),
      );
    }

    it('permite el acceso cuando no hay sesión iniciada', () => {
      authServiceSpy.autenticado.and.returnValue(false);

      expect(ejecutarGuestGuard()).toBeTrue();
    });

    it('redirige al panel del usuario cuando ya hay sesión iniciada', () => {
      authServiceSpy.autenticado.and.returnValue(true);
      authServiceSpy.rutaPanelSegunRol.and.returnValue('/admin/panel');

      const resultado = ejecutarGuestGuard() as UrlTree;

      expect(resultado instanceof UrlTree).toBeTrue();
      expect(router.serializeUrl(resultado)).toBe('/admin/panel');
    });
  });
});
