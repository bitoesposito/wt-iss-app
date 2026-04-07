// Angular
import { Component, OnDestroy, OnInit } from '@angular/core'
import { Subscription, combineLatest } from 'rxjs'

// PrimeNG
import { CardModule } from 'primeng/card'

// Interfaces
import { IssPosition, Position } from '../../interfaces/position.interface'

// Services
import { PositionStoreService } from '../../services/position-store'

@Component({
  selector: 'app-sidebar',
  imports: [
    CardModule
  ],
  templateUrl: './sidebar.html',
})

export class SidebarComponent implements OnInit, OnDestroy {
  private positionsSubscription: Subscription | undefined

  positions: Position[] = []
  isLoading = true
  private hasLoadedOnce = false
  selectedTimestamp: number | null = null
  private readonly CARD_BASE_CLASS =
    'border-1 border-slate-800 rounded-md p-3 bg-transparent hover:bg-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500'
  private readonly CARD_SELECTED_CLASS = 'ring-2 ring-blue-500 bg-slate-900'

  constructor (private readonly positionStoreService: PositionStoreService) {}

  ngOnInit () {
    this.positionsSubscription = combineLatest([
      this.positionStoreService.positions$,
      this.positionStoreService.selectedTimestamp$,
    ]).subscribe(([positions, selectedTimestamp]) => {
      this.selectedTimestamp = selectedTimestamp
      if (!this.hasLoadedOnce && positions.length === 0) return

      this.positions = positions.map((position) => this.toSidebarPosition(position))
      this.isLoading = false
      this.hasLoadedOnce = true
    })
  }

  ngOnDestroy () {
    this.positionsSubscription?.unsubscribe()
  }

  private toSidebarPosition (position: IssPosition): Position {
    return {
      id: position.timestamp,
      latitude: position.latitude,
      longitude: position.longitude,
      date: new Date(position.timestamp * 1000),
    }
  }

  handleSelectPosition (timestamp: number) {
    if (this.selectedTimestamp === timestamp) {
      this.positionStoreService.select(null)
      return
    }

    this.positionStoreService.select(timestamp)
  }

  getCardRootClass (timestamp: number) {
    if (this.selectedTimestamp !== timestamp) return this.CARD_BASE_CLASS
    return `${this.CARD_BASE_CLASS} ${this.CARD_SELECTED_CLASS}`
  }
}