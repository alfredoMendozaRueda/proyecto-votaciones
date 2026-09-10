import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { VotacionService } from '../../core/services/votacion.service';
import { Partido } from '../../core/models/partido.model';
import { Mensaje } from '../../core/models/mensaje.model';
import { Icon } from '../../shared/components/icon/icon';
import { Alert } from '../../shared/components/alert/alert';

@Component({
  selector: 'app-votacion',
  imports: [Icon, Alert],
  templateUrl: './votacion.html'
})
export class Votacion implements OnInit {
  private readonly votacionService = inject(VotacionService);

  readonly partidos = signal<Partido[]>([]);
  readonly seleccionado = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly votando = signal(false);

  ngOnInit(): void {
    this.votacionService.partidosParaVotar().subscribe({
      next: (partidos) => this.partidos.set(partidos),
      error: (respuesta: HttpErrorResponse) => {
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido cargar la lista de partidos');
      }
    });
  }

  seleccionar(siglas: string): void {
    this.seleccionado.set(siglas);
  }

  votar(): void {
    const siglas = this.seleccionado();
    if (!siglas) {
      return;
    }

    this.error.set(null);
    this.mensajeExito.set(null);
    this.votando.set(true);

    this.votacionService.votar(siglas).subscribe({
      next: (respuesta) => {
        this.votando.set(false);
        this.mensajeExito.set(respuesta.mensaje);
        this.partidos.set([]);
      },
      error: (respuesta: HttpErrorResponse) => {
        this.votando.set(false);
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido registrar el voto');
      }
    });
  }
}
