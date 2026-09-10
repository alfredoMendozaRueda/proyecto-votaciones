import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { CensoService } from '../../../core/services/censo.service';
import { LocalidadService } from '../../../core/services/localidad.service';
import { Censo } from '../../../core/models/censo.model';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

type Ambito = 'todo' | 'localidad' | 'comunidad';

@Component({
  selector: 'app-admin-censo',
  imports: [FormsModule, Icon, Alert],
  templateUrl: './admin-censo.html'
})
export class AdminCenso implements OnInit {
  private readonly censoService = inject(CensoService);
  private readonly localidadService = inject(LocalidadService);

  readonly localidades = signal<string[]>([]);
  readonly comunidades = signal<string[]>([]);
  readonly censo = signal<Censo[]>([]);
  readonly error = signal<string | null>(null);
  readonly consultado = signal(false);
  readonly consultando = signal(false);

  ambito: Ambito = 'todo';
  localidad = '';
  comunidad = '';

  ngOnInit(): void {
    this.localidadService.localidades().subscribe((localidades) => this.localidades.set(localidades));
    this.localidadService.comunidades().subscribe((comunidades) => this.comunidades.set(comunidades));
  }

  consultar(): void {
    this.error.set(null);
    this.consultado.set(false);
    this.consultando.set(true);

    const resultado$ =
      this.ambito === 'localidad'
        ? this.censoService.censoPorLocalidad(this.localidad)
        : this.ambito === 'comunidad'
          ? this.censoService.censoPorComunidad(this.comunidad)
          : this.censoService.censoCompleto();

    resultado$.subscribe({
      next: (censo) => {
        this.censo.set(censo);
        this.consultado.set(true);
        this.consultando.set(false);
      },
      error: (respuesta: HttpErrorResponse) => {
        this.consultando.set(false);
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido consultar el censo');
      }
    });
  }
}
