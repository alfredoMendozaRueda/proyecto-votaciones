import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Partido, PartidoRequest } from '../models/partido.model';

@Injectable({ providedIn: 'root' })
export class PartidoService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Partido[]> {
    return this.http.get<Partido[]>('/api/partidos');
  }

  crear(partido: PartidoRequest): Observable<Partido> {
    return this.http.post<Partido>('/api/partidos', partido);
  }

  comprobarMinimoRequerido(): Observable<Partido[]> {
    return this.http.get<Partido[]>('/api/partidos/comprobar');
  }
}
