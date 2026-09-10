import { Component, Input, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

import { ICONOS, NombreIcono } from '../../icons';

/**
 * Icono SVG en linea, sin dependencias externas. El contenido siempre sale
 * de ICONOS (definido en el propio codigo, nunca de datos externos), asi
 * que confiarlo como HTML seguro no introduce ningun riesgo de XSS.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      [style.width.px]="size"
      [style.height.px]="size"
      aria-hidden="true"
      [innerHTML]="marcado()"
    ></svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
      }
    `,
  ],
})
export class Icon {
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) set nombre(valor: NombreIcono) {
    this.nombreSignal.set(valor);
  }

  @Input() size = 20;
  @Input() strokeWidth = 1.8;

  private readonly nombreSignal = signal<NombreIcono | null>(null);

  readonly marcado = computed<SafeHtml>(() => {
    const nombre = this.nombreSignal();
    const svg = nombre ? ICONOS[nombre] : '';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });
}
