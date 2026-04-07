// Angular
import { Component } from '@angular/core';

// PrimeNG
import { CardModule } from 'primeng/card';

// Interfaces
import { Position } from '../../interfaces/position.interface';

@Component({
  selector: 'app-sidebar',
  imports: [
    CardModule
  ],
  templateUrl: './sidebar-component.html',
})
export class SidebarComponent {

  positions: Position[] = [
    {id: 1, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 2, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 3, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 4, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 5, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 6, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 7, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 8, latitude: 90.000000, longitude: 90.000000, date: new Date()},
    {id: 9, latitude: 90.000000, longitude: 90.000000, date: new Date()},
  ];
}