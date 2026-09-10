import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Censo } from '../models/censo.model';

@Injectable({ providedIn: 'root' })
export class CensoService {
  private readonly http = inject(HttpClient);

  censoCompleto(): Observable<Censo[]> {
    return this.http.get<Censo[]>('/api/censo');
  }

  censoPorLocalidad(localidad: string): Observable<Censo[]> {
    return this.http.get<Censo[]>('/api/censo', { params: { localidad } });
  }

  censoPorComunidad(comunidad: string): Observable<Censo[]> {
    return this.http.get<Censo[]>('/api/censo', { params: { comunidad } });
  }
}
