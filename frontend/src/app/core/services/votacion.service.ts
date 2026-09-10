import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Mensaje } from '../models/mensaje.model';
import { Partido } from '../models/partido.model';

@Injectable({ providedIn: 'root' })
export class VotacionService {
  private readonly http = inject(HttpClient);

  partidosParaVotar(): Observable<Partido[]> {
    return this.http.get<Partido[]>('/api/votacion/partidos');
  }

  votar(siglasPartido: string): Observable<Mensaje> {
    return this.http.post<Mensaje>('/api/votacion', { siglasPartido });
  }
}
