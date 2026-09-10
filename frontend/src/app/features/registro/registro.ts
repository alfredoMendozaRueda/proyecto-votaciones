import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { RegistroService } from '../../core/services/registro.service';
import { Mensaje } from '../../core/models/mensaje.model';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink],
  templateUrl: './registro.html'
})
export class Registro {
  private readonly registroService = inject(RegistroService);

  dni = '';
  contrasena = '';
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);

  enviar(): void {
    this.error.set(null);
    this.mensajeExito.set(null);
    this.enviando.set(true);

    this.registroService.registrar(this.dni, this.contrasena).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.mensajeExito.set(respuesta.mensaje);
        this.dni = '';
        this.contrasena = '';
      },
      error: (respuesta: HttpErrorResponse) => {
        this.enviando.set(false);
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido completar el registro');
      }
    });
  }
}
