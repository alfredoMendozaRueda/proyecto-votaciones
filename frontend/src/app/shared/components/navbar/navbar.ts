import { Component, inject } from '@angular/core';
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

  cerrarSesion(): void {
    const dni = this.usuario()?.dni;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/despedida'], { queryParams: { dni } }),
      error: () => this.router.navigate(['/despedida'], { queryParams: { dni } }),
    });
  }
}
