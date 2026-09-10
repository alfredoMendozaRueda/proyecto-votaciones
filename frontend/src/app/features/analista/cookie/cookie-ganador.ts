import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { CookieGanadorService } from '../../../core/services/cookie-ganador.service';
import { Mensaje } from '../../../core/models/mensaje.model';

@Component({
  selector: 'app-cookie-ganador',
  templateUrl: './cookie-ganador.html'
})
export class CookieGanador implements OnInit {
  private readonly cookieGanadorService = inject(CookieGanadorService);

  readonly partidoGanador = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly creando = signal(false);

  ngOnInit(): void {
    this.consultar();
  }

  consultar(): void {
    this.cookieGanadorService.ver().subscribe((cookie) => this.partidoGanador.set(cookie.partidoGanador));
  }

  crear(): void {
    this.error.set(null);
    this.mensajeExito.set(null);
    this.creando.set(true);

    this.cookieGanadorService.crear().subscribe({
      next: (respuesta) => {
        this.creando.set(false);
        this.mensajeExito.set(respuesta.mensaje);
        this.consultar();
      },
      error: (respuesta: HttpErrorResponse) => {
        this.creando.set(false);
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido crear la cookie');
      }
    });
  }
}
