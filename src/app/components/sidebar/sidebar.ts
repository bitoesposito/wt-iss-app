// Angular
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'

// PrimeNG
import { CardModule } from 'primeng/card'
import { SelectButtonModule } from 'primeng/selectbutton'
import { CheckboxModule } from 'primeng/checkbox'
import { ButtonModule } from 'primeng/button'

// Interfaces
import { Position } from '../../interfaces/position.interface'

// Services
import { PositionStoreService } from '../../store/position-store'
import { ViewMode, ViewModeStoreService } from '../../store/view-mode-store'
import { SatellitesStoreService } from '../../store/satellites-store'
import { TleSatellite } from '../../services/satellites-tle.service'
import { SatellitesSceneControllerService } from '../../controller/satellites-scene-controller'

@Component({
  selector: 'app-sidebar',
  imports: [
    CardModule,
    ButtonModule,
    SelectButtonModule,
    CheckboxModule,
    FormsModule,
  ],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class SidebarComponent {
  private readonly positionStoreService = inject(PositionStoreService)
  private readonly viewModeStoreService = inject(ViewModeStoreService)
  private readonly satellitesStoreService = inject(SatellitesStoreService)
  private readonly satellitesSceneControllerService = inject(SatellitesSceneControllerService)

  readonly viewMode = this.viewModeStoreService.viewMode
  readonly viewModeOptions: Array<{ label: string, value: ViewMode }> = [
    { label: 'ISS', value: 'iss' },
    { label: 'Satelliti', value: 'satellites' },
  ]

  readonly selectedTimestamp = this.positionStoreService.selectedTimestamp
  readonly selectionIntent = this.positionStoreService.selectionIntent
  readonly satellites = this.satellitesStoreService.satellites
  readonly satellitesIsLoading = this.satellitesStoreService.isLoading
  readonly satellitesLoadError = this.satellitesStoreService.loadError
  readonly selectedSatellites = this.satellitesStoreService.selectedSatellites

  readonly positions = computed<Position[]>(() =>
    this.positionStoreService.positions().map((position) => ({
      id: position.timestamp,
      latitude: position.latitude,
      longitude: position.longitude,
      date: new Date(position.timestamp * 1000),
    })),
  )

  // Rimane in loading finché non compare almeno una posizione nello storage.
  readonly isLoading = computed(() => this.positions().length === 0)
  private readonly CARD_BASE_CLASS =
    'border-1 border-slate-800 rounded-md p-3 bg-transparent hover:bg-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary'
  private readonly CARD_SELECTED_CLASS = 'bg-slate-900'

  handleViewModeChange (mode: ViewMode) {
    this.viewModeStoreService.setViewMode(mode)
    if (mode === 'satellites') {
      this.satellitesStoreService.loadStations()
    }
  }

  isSatelliteSelected (sat: TleSatellite): boolean {
    return this.satellitesStoreService.isSelected(sat.name)
  }

  handleSatelliteToggle (sat: TleSatellite, checked: unknown) {
    if (typeof checked !== 'boolean') return
    this.satellitesStoreService.setSelected(sat.name, checked)
  }

  handleFocusSatellite (sat: TleSatellite) {
    if (!this.isSatelliteSelected(sat)) {
      this.satellitesStoreService.setSelected(sat.name, true)
    }

    this.satellitesSceneControllerService.focusSatellite(sat)
  }

  handleSelectAllSatellites () {
    this.satellitesStoreService.selectAll()
  }

  handleClearSatellitesSelection () {
    this.satellitesStoreService.clearSelection()
  }

  handleHoverPosition (timestamp: number) {
    if (this.selectedTimestamp() === timestamp) return
    this.positionStoreService.select(timestamp, 'hover')
  }

  handleFocusIssPosition (timestamp: number, event?: Event) {
    event?.stopPropagation?.()
    event?.preventDefault?.()

    const isSameSelection = this.selectedTimestamp() === timestamp
    const isPinnedByClick = this.selectionIntent() === 'click'

    if (isSameSelection && isPinnedByClick) {
      this.positionStoreService.select(null)
    }

    this.positionStoreService.select(timestamp, 'click')
  }

  handleSelectPosition (timestamp: number) {
    const isSameSelection = this.selectedTimestamp() === timestamp
    const isPinnedByClick = this.selectionIntent() === 'click'

    // UX: se l'elemento è già selezionato per hover, il primo click lo "pinna"
    // e apre il popup. Solo un secondo click (già pinned) deseleziona.
    if (isSameSelection && isPinnedByClick) {
      this.positionStoreService.select(null)
      return
    }

    this.positionStoreService.select(timestamp, 'click')
  }

  getCardRootClass (timestamp: number) {
    if (this.selectedTimestamp() !== timestamp) return this.CARD_BASE_CLASS
    return `${this.CARD_BASE_CLASS} ${this.CARD_SELECTED_CLASS}`
  }
}