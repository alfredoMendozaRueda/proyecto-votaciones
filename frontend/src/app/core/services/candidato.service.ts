import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Candidato, CandidatoRequest } from '../models/candidato.model';

@Injectable({ providedIn: 'root' })
export class CandidatoService {
  private readonly http = inject(HttpClient);

  crear(candidato: CandidatoRequest): Observable<Candidato> {
    return this.http.post<Candidato>('/api/candidatos', candidato);
  }

  candidatosDeLocalidad(localidad: string): Observable<Candidato[]> {
    return this.http.get<Candidato[]>('/api/candidatos', { params: { localidad } });
  }
}
