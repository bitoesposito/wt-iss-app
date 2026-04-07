import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal } from '@angular/core';

// Services
import { IssTrackerService } from './services/iss-tracker';
import { IssPosition } from './interfaces/position.interface';

// Components
import { SidebarComponent } from './components/sidebar-component/sidebar';
import { MapComponent } from './components/map/map';

@Component({
  selector: 'app-root',
  imports: [
    SidebarComponent,
    MapComponent
  ],
  templateUrl: './app.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})

export class App {
  constructor (
    private readonly issTrackerService: IssTrackerService
  ) {}

  
}
