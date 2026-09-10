import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-despedida',
  imports: [RouterLink],
  templateUrl: './despedida.html'
})
export class Despedida {
  private readonly route = inject(ActivatedRoute);

  readonly dni = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('dni'))), {
    initialValue: null
  });
}
