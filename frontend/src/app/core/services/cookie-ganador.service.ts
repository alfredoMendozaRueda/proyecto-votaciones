import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CookieGanador } from '../models/resultado.model';
import { Mensaje } from '../models/mensaje.model';

@Injectable({ providedIn: 'root' })
export class CookieGanadorService {
  private readonly http = inject(HttpClient);

  crear(): Observable<Mensaje> {
    return this.http.post<Mensaje>('/api/cookie-ganador', {});
  }

  ver(): Observable<CookieGanador> {
    return this.http.get<CookieGanador>('/api/cookie-ganador');
  }
}
