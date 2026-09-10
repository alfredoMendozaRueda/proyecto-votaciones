import { Component, OnInit, inject, signal } from '@angular/core';

import { ResultadosService } from '../../core/services/resultados.service';
import { Ganador as GanadorModel } from '../../core/models/resultado.model';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-ganador',
  imports: [Icon],
  templateUrl: './ganador.html'
})
export class Ganador implements OnInit {
  private readonly resultadosService = inject(ResultadosService);

  readonly ganador = signal<GanadorModel | null>(null);

  ngOnInit(): void {
    this.resultadosService.ganador().subscribe((ganador) => this.ganador.set(ganador));
  }
}
