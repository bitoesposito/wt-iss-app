// Angular
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'

// PrimeNG
import { CardModule } from 'primeng/card'

// Interfaces
import { Position } from '../../interfaces/position.interface'

// Services
import { PositionStoreService } from '../../services/position-store'

@Component({
  selector: 'app-sidebar',
  imports: [
    CardModule
  ],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class SidebarComponent {
  private readonly positionStoreService = inject(PositionStoreService)

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
    'border-1 border-slate-800 rounded-md p-3 bg-transparent hover:bg-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500'
  private readonly CARD_SELECTED_CLASS = 'ring-2 ring-blue-500 bg-slate-900'

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