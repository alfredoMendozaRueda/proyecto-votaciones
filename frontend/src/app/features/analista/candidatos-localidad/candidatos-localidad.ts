import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { CandidatoService } from '../../../core/services/candidato.service';
import { LocalidadService } from '../../../core/services/localidad.service';
import { Candidato } from '../../../core/models/candidato.model';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-candidatos-localidad',
  imports: [FormsModule, Icon, Alert],
  templateUrl: './candidatos-localidad.html',
})
export class CandidatosLocalidad implements OnInit {
  private readonly candidatoService = inject(CandidatoService);
  private readonly localidadService = inject(LocalidadService);

  readonly localidades = signal<string[]>([]);
  readonly candidatos = signal<Candidato[] | null>(null);
  readonly error = signal<string | null>(null);
  readonly consultando = signal(false);

  localidad = '';

  ngOnInit(): void {
    this.localidadService
      .localidades()
      .subscribe((localidades) => this.localidades.set(localidades));
  }

  consultar(): void {
    this.error.set(null);
    this.candidatos.set(null);
    this.consultando.set(true);

    this.candidatoService.candidatosDeLocalidad(this.localidad).subscribe({
      next: (candidatos) => {
        this.consultando.set(false);
        this.candidatos.set(candidatos);
      },
      error: (respuesta: HttpErrorResponse) => {
        this.consultando.set(false);
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se ha podido consultar los candidatos');
      },
    });
  }
}
