import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { EleccionService } from '../../../core/services/eleccion.service';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-admin-elecciones',
  imports: [FormsModule, Icon, Alert],
  templateUrl: './admin-elecciones.html'
})
export class AdminElecciones {
  private readonly eleccionService = inject(EleccionService);

  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly procesando = signal<'habilitar' | 'deshabilitar' | 'eliminar' | null>(null);

  idElecciones = '';
  descripcion = '';
  fechaFin = '';

  idGestion = '';

  private limpiarMensajes(): void {
    this.error.set(null);
    this.mensajeExito.set(null);
  }

  private manejarError(respuesta: HttpErrorResponse, mensajePorDefecto: string): void {
    this.enviando.set(false);
    this.procesando.set(null);
    const cuerpo = respuesta.error as Mensaje | undefined;
    this.error.set(cuerpo?.mensaje ?? mensajePorDefecto);
  }

  crear(): void {
    this.limpiarMensajes();
    this.enviando.set(true);

    this.eleccionService.crear({ idElecciones: this.idElecciones, descripcion: this.descripcion, fechaFin: this.fechaFin }).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.mensajeExito.set(respuesta.mensaje);
        this.idElecciones = '';
        this.descripcion = '';
        this.fechaFin = '';
      },
      error: (respuesta: HttpErrorResponse) => this.manejarError(respuesta, 'No se ha podido crear la elección')
    });
  }

  habilitar(): void {
    this.limpiarMensajes();
    this.procesando.set('habilitar');
    this.eleccionService.habilitar(this.idGestion).subscribe({
      next: (respuesta) => {
        this.procesando.set(null);
        this.mensajeExito.set(respuesta.mensaje);
      },
      error: (respuesta: HttpErrorResponse) => this.manejarError(respuesta, 'No se ha podido habilitar la elección')
    });
  }

  deshabilitar(): void {
    this.limpiarMensajes();
    this.procesando.set('deshabilitar');
    this.eleccionService.deshabilitar(this.idGestion).subscribe({
      next: (respuesta) => {
        this.procesando.set(null);
        this.mensajeExito.set(respuesta.mensaje);
      },
      error: (respuesta: HttpErrorResponse) => this.manejarError(respuesta, 'No se ha podido deshabilitar la elección')
    });
  }

  eliminar(): void {
    this.limpiarMensajes();
    this.procesando.set('eliminar');
    this.eleccionService.eliminar(this.idGestion).subscribe({
      next: (respuesta) => {
        this.procesando.set(null);
        this.mensajeExito.set(respuesta.mensaje);
      },
      error: (respuesta: HttpErrorResponse) => this.manejarError(respuesta, 'No se ha podido eliminar la elección')
    });
  }
}
