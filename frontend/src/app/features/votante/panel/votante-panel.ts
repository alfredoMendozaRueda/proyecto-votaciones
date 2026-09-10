import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-votante-panel',
  imports: [RouterLink, Icon],
  templateUrl: './votante-panel.html',
})
export class VotantePanel {}
