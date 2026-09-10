import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Mensaje } from '../models/mensaje.model';
import { Porcentaje } from '../models/resultado.model';

@Injectable({ providedIn: 'root' })
export class ParticipacionService {
  private readonly http = inject(HttpClient);

  recalcular(): Observable<Mensaje> {
    return this.http.post<Mensaje>('/api/participacion/recalcular', {});
  }

  porcentajes(): Observable<Porcentaje[]> {
    return this.http.get<Porcentaje[]>('/api/participacion/porcentajes');
  }
}
