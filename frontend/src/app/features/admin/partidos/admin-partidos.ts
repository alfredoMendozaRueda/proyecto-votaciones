import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { PartidoService } from '../../../core/services/partido.service';
import { Partido } from '../../../core/models/partido.model';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-admin-partidos',
  imports: [FormsModule, Icon, Alert],
  templateUrl: './admin-partidos.html'
})
export class AdminPartidos implements OnInit {
  private readonly partidoService = inject(PartidoService);

  readonly partidos = signal<Partido[]>([]);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly cargando = signal(true);

  siglas = '';
  descripcion = '';
  imagen = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.partidoService.listar().subscribe((partidos) => {
      this.partidos.set(partidos);
      this.cargando.set(false);
    });
  }

  crear(): void {
    this.error.set(null);
    this.mensajeExito.set(null);
    this.enviando.set(true);

    this.partidoService
      .crear({ siglas: this.siglas, descripcion: this.descripcion, imagen: this.imagen })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.mensajeExito.set('Partido registrado con éxito');
          this.siglas = '';
          this.descripcion = '';
          this.imagen = '';
          this.cargar();
        },
        error: (respuesta: HttpErrorResponse) => {
          this.enviando.set(false);
          const cuerpo = respuesta.error as Mensaje | undefined;
          this.error.set(cuerpo?.mensaje ?? 'No se ha podido registrar el partido');
        }
      });
  }
}
