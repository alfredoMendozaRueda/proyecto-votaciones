import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html'
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  dni = '';
  contrasena = '';
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  enviar(): void {
    this.error.set(null);
    this.enviando.set(true);

    this.authService.login(this.dni, this.contrasena).subscribe({
      next: () => {
        this.enviando.set(false);
        this.router.navigateByUrl(this.authService.rutaPanelSegunRol());
      },
      error: (respuesta: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(
          respuesta.status === 401
            ? 'DNI o contraseña incorrectos'
            : 'No se ha podido iniciar sesión, inténtalo de nuevo'
        );
      }
    });
  }
}
