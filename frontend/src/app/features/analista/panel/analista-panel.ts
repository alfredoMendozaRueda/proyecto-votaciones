import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-analista-panel',
  imports: [RouterLink, Icon],
  templateUrl: './analista-panel.html'
})
export class AnalistaPanel {}
