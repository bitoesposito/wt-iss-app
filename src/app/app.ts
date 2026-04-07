import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SidebarComponent } from './ui/sidebar-component/sidebar-component';
import { MapComponent } from './ui/map-component/map-component';

@Component({
  selector: 'app-root',
  imports: [
    SidebarComponent,
    MapComponent,
  ],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('iss-app');
}
