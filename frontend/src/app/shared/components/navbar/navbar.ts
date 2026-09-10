import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html'
})
export class Navbar {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.authService.usuario;

  cerrarSesion(): void {
    const dni = this.usuario()?.dni;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/despedida'], { queryParams: { dni } }),
      error: () => this.router.navigate(['/despedida'], { queryParams: { dni } })
    });
  }
}
