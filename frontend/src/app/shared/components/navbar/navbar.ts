import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './navbar.html',
})
export class Navbar {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.authService.usuario;

  /**
   * Menú móvil colapsable, implementado a mano (sin el JS de Bootstrap:
   * solo se usaba para esto y el bundle no compensa por un simple toggle).
   */
  readonly menuAbierto = signal(false);

  toggleMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarSesion(): void {
    const dni = this.usuario()?.dni;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/despedida'], { queryParams: { dni } }),
      error: () => this.router.navigate(['/despedida'], { queryParams: { dni } }),
    });
  }
}
