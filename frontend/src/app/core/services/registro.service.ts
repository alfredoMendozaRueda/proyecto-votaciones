import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Mensaje } from '../models/mensaje.model';

@Injectable({ providedIn: 'root' })
export class RegistroService {
  private readonly http = inject(HttpClient);

  registrar(dni: string, contrasena: string): Observable<Mensaje> {
    return this.http.post<Mensaje>('/api/registro', { dni, contrasena });
  }
}
