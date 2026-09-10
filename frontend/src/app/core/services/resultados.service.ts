import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Ganador, Resultado } from '../models/resultado.model';

@Injectable({ providedIn: 'root' })
export class ResultadosService {
  private readonly http = inject(HttpClient);

  resultadosGlobales(): Observable<Resultado[]> {
    return this.http.get<Resultado[]>('/api/resultados');
  }

  resultadosPorLocalidad(localidad: string): Observable<Resultado[]> {
    return this.http.get<Resultado[]>('/api/resultados', { params: { localidad } });
  }

  resultadosPorComunidad(comunidad: string): Observable<Resultado[]> {
    return this.http.get<Resultado[]>('/api/resultados', { params: { comunidad } });
  }

  ganador(): Observable<Ganador> {
    return this.http.get<Ganador>('/api/ganador');
  }
}
