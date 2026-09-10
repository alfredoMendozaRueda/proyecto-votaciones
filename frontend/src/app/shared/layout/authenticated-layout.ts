import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from '../components/navbar/navbar';

@Component({
  selector: 'app-authenticated-layout',
  imports: [Navbar, RouterOutlet],
  template: `
    <app-navbar />
    <router-outlet />
  `,
})
export class AuthenticatedLayout {}
