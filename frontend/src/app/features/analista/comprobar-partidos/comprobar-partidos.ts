import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { PartidoService } from '../../../core/services/partido.service';
import { Partido } from '../../../core/models/partido.model';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-comprobar-partidos',
  imports: [Icon, Alert],
  templateUrl: './comprobar-partidos.html'
})
export class ComprobarPartidos implements OnInit {
  private readonly partidoService = inject(PartidoService);

  readonly partidos = signal<Partido[] | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.partidoService.comprobarMinimoRequerido().subscribe({
      next: (partidos) => this.partidos.set(partidos),
      error: (respuesta: HttpErrorResponse) => {
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido comprobar los partidos');
      }
    });
  }
}
