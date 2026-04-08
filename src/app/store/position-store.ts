import { Injectable, computed, effect, signal } from '@angular/core'

import { IssPosition } from '../interfaces/position.interface'

export type SelectionIntent = 'click' | 'hover' | 'map'

@Injectable({
  providedIn: 'root',
})

export class PositionStoreService {
  // `positions` contiene lo storico (max 25) e rappresenta la “fonte di verità” condivisa.
  private readonly STORAGE_KEY = 'positions'

  // `positions.selected` contiene il timestamp della posizione selezionata (o nulla).
  private readonly SELECTED_KEY = 'positions.selected'
  private readonly MAX_POSITIONS = 25

  readonly positions = signal<IssPosition[]>(this.readPositions())
  readonly selectedTimestamp = signal<number | null>(this.readSelectedTimestamp())
  readonly selectionIntent = signal<SelectionIntent | null>(null)

  readonly latestTimestamp = computed(() => this.positions()?.[0]?.timestamp ?? null)
  readonly selectedPosition = computed(() => {
    const timestamp = this.selectedTimestamp()
    if (!timestamp) return null

    return this.positions().find((p) => p.timestamp === timestamp) ?? null
  })

  constructor () {
    effect(() => {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.positions()))
    })

    effect(() => {
      const timestamp = this.selectedTimestamp()
      if (timestamp === null) {
        sessionStorage.removeItem(this.SELECTED_KEY)
        return
      }

      sessionStorage.setItem(this.SELECTED_KEY, String(timestamp))
    })
  }

  add(position: IssPosition) {
    this.positions.update((current) => {
      const next = [position, ...current].slice(0, this.MAX_POSITIONS)
      return next
    })
  }

  select(timestamp: number | null, intent: SelectionIntent | null = null) {
    // La selezione è centralizzata: chiunque (sidebar o mappa) può chiamare `select()`
    // e tutte le UI si aggiornano tramite `selectedTimestamp$`.
    this.selectedTimestamp.set(timestamp)
    this.selectionIntent.set(timestamp === null ? null : intent)
  }

  clear(): void {
    this.positions.set([])
    this.selectedTimestamp.set(null)
    this.selectionIntent.set(null)
  }

  private readSelectedTimestamp(): number | null {
    const raw = sessionStorage.getItem(this.SELECTED_KEY)
    if (!raw) return null

    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null

    return parsed
  }

  private readPositions(): IssPosition[] {
    const raw = sessionStorage.getItem(this.STORAGE_KEY)
    if (!raw) return []

    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter((item) => this.isIssPosition(item))
        .slice(0, this.MAX_POSITIONS)
    } catch {
      return []
    }
  }

  private isIssPosition(value: unknown): value is IssPosition {
    if (!value || typeof value !== 'object') return false

    const candidate = value as Partial<IssPosition>

    return (
      typeof candidate.latitude === 'number' &&
      Number.isFinite(candidate.latitude) &&
      typeof candidate.longitude === 'number' &&
      Number.isFinite(candidate.longitude) &&
      typeof candidate.timestamp === 'number' &&
      Number.isFinite(candidate.timestamp)
    )
  }
}
