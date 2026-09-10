import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { CandidatoService } from '../../../core/services/candidato.service';
import { PartidoService } from '../../../core/services/partido.service';
import { Partido } from '../../../core/models/partido.model';
import { Mensaje } from '../../../core/models/mensaje.model';
import { Icon } from '../../../shared/components/icon/icon';
import { Alert } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-admin-candidatos',
  imports: [FormsModule, Icon, Alert],
  templateUrl: './admin-candidatos.html'
})
export class AdminCandidatos implements OnInit {
  private readonly candidatoService = inject(CandidatoService);
  private readonly partidoService = inject(PartidoService);

  readonly partidos = signal<Partido[]>([]);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly enviando = signal(false);

  dni = '';
  nombreCompleto = '';
  siglasPartido = '';
  orden = 1;

  ngOnInit(): void {
    this.partidoService.listar().subscribe((partidos) => this.partidos.set(partidos));
  }

  crear(): void {
    this.error.set(null);
    this.mensajeExito.set(null);
    this.enviando.set(true);

    this.candidatoService
      .crear({
        dni: this.dni,
        nombreCompleto: this.nombreCompleto,
        siglasPartido: this.siglasPartido,
        orden: Number(this.orden)
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.mensajeExito.set('Candidato registrado con éxito');
          this.dni = '';
          this.nombreCompleto = '';
          this.orden = 1;
        },
        error: (respuesta: HttpErrorResponse) => {
          this.enviando.set(false);
          const cuerpo = respuesta.error as Mensaje | undefined;
          this.error.set(cuerpo?.mensaje ?? 'No se ha podido registrar el candidato');
        }
      });
  }
}
