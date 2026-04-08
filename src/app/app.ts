import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core'

// Components
import { SidebarComponent } from './components/sidebar/sidebar'
import { MapComponent } from './components/map/map'

@Component({
  selector: 'app-root',
  imports: [
    SidebarComponent,
    MapComponent
  ],
  templateUrl: './app.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class App {
  protected readonly title = signal('iss-app')
}
