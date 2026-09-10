import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { ResultadosService } from '../../core/services/resultados.service';
import { LocalidadService } from '../../core/services/localidad.service';
import { Resultado } from '../../core/models/resultado.model';
import { Mensaje } from '../../core/models/mensaje.model';
import { Icon } from '../../shared/components/icon/icon';
import { Alert } from '../../shared/components/alert/alert';

type Ambito = 'todo' | 'localidad' | 'comunidad';

@Component({
  selector: 'app-resultados',
  imports: [FormsModule, RouterLink, Icon, Alert],
  templateUrl: './resultados.html'
})
export class Resultados implements OnInit {
  private readonly resultadosService = inject(ResultadosService);
  private readonly localidadService = inject(LocalidadService);

  readonly localidades = signal<string[]>([]);
  readonly comunidades = signal<string[]>([]);
  readonly resultados = signal<Resultado[] | null>(null);
  readonly error = signal<string | null>(null);

  ambito: Ambito = 'todo';
  localidad = '';
  comunidad = '';

  ngOnInit(): void {
    this.localidadService.localidades().subscribe((localidades) => this.localidades.set(localidades));
    this.localidadService.comunidades().subscribe((comunidades) => this.comunidades.set(comunidades));
  }

  consultar(): void {
    this.error.set(null);
    this.resultados.set(null);

    const resultado$ =
      this.ambito === 'localidad'
        ? this.resultadosService.resultadosPorLocalidad(this.localidad)
        : this.ambito === 'comunidad'
          ? this.resultadosService.resultadosPorComunidad(this.comunidad)
          : this.resultadosService.resultadosGlobales();

    resultado$.subscribe({
      next: (resultados) => this.resultados.set(resultados),
      error: (respuesta: HttpErrorResponse) => {
        const cuerpo = respuesta.error as Mensaje | undefined;
        this.error.set(cuerpo?.mensaje ?? 'No se han podido consultar los resultados');
      }
    });
  }

  totalVotos(): number {
    return (this.resultados() ?? []).reduce((total, resultado) => total + resultado.votos, 0);
  }

  porcentaje(votos: number): number {
    const total = this.totalVotos();
    return total > 0 ? (votos / total) * 100 : 0;
  }
}
