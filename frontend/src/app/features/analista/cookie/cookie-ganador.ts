import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { CookieGanadorService } from '../../../core/services/cookie-ganador.service';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-cookie-ganador',
  imports: [Icon, Alert],
  templateUrl: './cookie-ganador.html'
})
export class CookieGanador implements OnInit {
  private readonly cookieGanadorService = inject(CookieGanadorService);

  readonly partidoGanador = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly creando = signal(false);
  readonly consultando = signal(true);

  ngOnInit(): void {
    this.consultar();
  }

  consultar(): void {
    this.consultando.set(true);
    this.cookieGanadorService.ver().subscribe((cookie) => {
      this.partidoGanador.set(cookie.partidoGanador);
      this.consultando.set(false);
    });
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
