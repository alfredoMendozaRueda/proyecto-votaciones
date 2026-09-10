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
    <p class="alerta" [class.alerta-error]="tipo === 'error'" [class.alerta-exito]="tipo === 'exito'">
      <app-icon [nombre]="tipo === 'error' ? 'error' : 'exito'" [size]="18" />
      <span>{{ mensaje }}</span>
    </p>
  `
})
export class Alert {
  @Input() tipo: 'exito' | 'error' = 'exito';
  @Input() mensaje = '';
}
