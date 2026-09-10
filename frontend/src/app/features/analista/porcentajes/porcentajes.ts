import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { ParticipacionService } from '../../../core/services/participacion.service';
import { Porcentaje } from '../../../core/models/resultado.model';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-porcentajes',
  imports: [DecimalPipe, Icon, Alert],
  templateUrl: './porcentajes.html',
})
export class Porcentajes implements OnInit {
  private readonly participacionService = inject(ParticipacionService);

  readonly porcentajes = signal<Porcentaje[]>([]);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly recalculando = signal(false);
  readonly cargando = signal(true);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.error.set(null);
    this.participacionService.porcentajes().subscribe({
      next: (porcentajes) => {
        this.porcentajes.set(porcentajes);
        this.cargando.set(false);
      },
      error: (respuesta: HttpErrorResponse) => {
        this.cargando.set(false);
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido consultar la participación');
      },
    });
  }

  recalcular(): void {
    this.error.set(null);
    this.mensajeExito.set(null);
    this.recalculando.set(true);

    this.participacionService.recalcular().subscribe({
      next: (respuesta) => {
        this.recalculando.set(false);
        this.mensajeExito.set(respuesta.mensaje);
        this.cargar();
      },
      error: (respuesta: HttpErrorResponse) => {
        this.recalculando.set(false);
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido recalcular la participación');
      },
    });
  }
}
