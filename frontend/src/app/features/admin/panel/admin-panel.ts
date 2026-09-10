import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-admin-panel',
  imports: [RouterLink, Icon],
  templateUrl: './admin-panel.html',
})
export class AdminPanel {}
