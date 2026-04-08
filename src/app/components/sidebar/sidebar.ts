// Angular
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'

// PrimeNG
import { CardModule } from 'primeng/card'
import { SelectButtonModule } from 'primeng/selectbutton'

// Interfaces
import { Position } from '../../interfaces/position.interface'

// Services
import { PositionStoreService } from '../../services/position-store'

type ViewMode = 'iss' | 'satellites'

@Component({
  selector: 'app-sidebar',
  imports: [
    CardModule,
    SelectButtonModule,
    FormsModule,
  ],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class SidebarComponent {
  private readonly positionStoreService = inject(PositionStoreService)

  readonly viewMode = signal<ViewMode>('iss')
  readonly viewModeOptions: Array<{ label: string, value: ViewMode }> = [
    { label: 'ISS', value: 'iss' },
    { label: 'Satelliti', value: 'satellites' },
  ]

  readonly selectedTimestamp = this.positionStoreService.selectedTimestamp
  readonly selectionIntent = this.positionStoreService.selectionIntent

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
  private readonly CARD_SELECTED_CLASS = 'ring-2 ring-primary bg-slate-900'

  handleViewModeChange (mode: ViewMode) {
    this.viewMode.set(mode)
  }

  handleHoverPosition (timestamp: number) {
    if (this.selectedTimestamp() === timestamp) return
    this.positionStoreService.select(timestamp, 'hover')
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