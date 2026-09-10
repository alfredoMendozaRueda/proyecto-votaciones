import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LocalidadService {
  private readonly http = inject(HttpClient);

  localidades(): Observable<string[]> {
    return this.http.get<string[]>('/api/localidades');
  }

  comunidades(): Observable<string[]> {
    return this.http.get<string[]>('/api/comunidades');
  }
}
