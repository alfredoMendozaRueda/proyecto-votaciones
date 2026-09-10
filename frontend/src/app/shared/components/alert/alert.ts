import { Component, Input } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Mensaje de estado (exito/error) con icono, para no repetir el mismo
 * bloque en cada pantalla que muestra el resultado de una accion.
 */
@Component({
  selector: 'app-alert',
  imports: [Icon],
  template: `
    <div
      class="alert d-flex align-items-center gap-2 animar-entrada"
      [class.alert-danger]="tipo === 'error'"
      [class.alert-success]="tipo === 'exito'"
      role="alert"
    >
      <app-icon [nombre]="tipo === 'error' ? 'error' : 'exito'" [size]="18" />
      <span>{{ mensaje }}</span>
    </div>
  `
})
export class Alert {
  @Input() tipo: 'exito' | 'error' = 'exito';
  @Input() mensaje = '';
}
