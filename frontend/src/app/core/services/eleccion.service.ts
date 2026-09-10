import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EleccionRequest } from '../models/eleccion.model';
import { Mensaje } from '../models/mensaje.model';

@Injectable({ providedIn: 'root' })
export class EleccionService {
  private readonly http = inject(HttpClient);

  crear(eleccion: EleccionRequest): Observable<Mensaje> {
    return this.http.post<Mensaje>('/api/elecciones', eleccion);
  }

  habilitar(idElecciones: string): Observable<Mensaje> {
    return this.http.put<Mensaje>(`/api/elecciones/${idElecciones}/habilitar`, {});
  }

  deshabilitar(idElecciones: string): Observable<Mensaje> {
    return this.http.put<Mensaje>(`/api/elecciones/${idElecciones}/deshabilitar`, {});
  }

  eliminar(idElecciones: string): Observable<Mensaje> {
    return this.http.delete<Mensaje>(`/api/elecciones/${idElecciones}`);
  }
}
