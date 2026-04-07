import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

import { IssPosition } from '../interfaces/position.interface'

@Injectable({
  providedIn: 'root',
})

export class PositionStoreService {
  // `positions` contiene lo storico (max 25) e rappresenta la “fonte di verità” condivisa.
  private readonly STORAGE_KEY = 'positions'

  // `positions.selected` contiene il timestamp della posizione selezionata (o nulla).
  private readonly SELECTED_KEY = 'positions.selected'
  private readonly MAX_POSITIONS = 25

  // Stream reattivi usati da sidebar e mappa per restare coerenti con lo storage.
  private readonly positionsSubject = new BehaviorSubject<IssPosition[]>(this.get())
  readonly positions$ = this.positionsSubject.asObservable()

  private readonly selectedTimestampSubject = new BehaviorSubject<number | null>(
    this.getSelectedTimestamp(),
  )
  readonly selectedTimestamp$ = this.selectedTimestampSubject.asObservable()

  get(): IssPosition[] {
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

  add(position: IssPosition): IssPosition[] {
    const positions = this.get()

    positions.unshift(position)

    if (positions.length > this.MAX_POSITIONS) {
      positions.pop()
    }

    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(positions))
    this.positionsSubject.next(positions)
    return positions
  }

  select(timestamp: number | null) {
    // La selezione è centralizzata: chiunque (sidebar o mappa) può chiamare `select()`
    // e tutte le UI si aggiornano tramite `selectedTimestamp$`.
    if (timestamp === null) {
      sessionStorage.removeItem(this.SELECTED_KEY)
      this.selectedTimestampSubject.next(null)
      return
    }

    sessionStorage.setItem(this.SELECTED_KEY, String(timestamp))
    this.selectedTimestampSubject.next(timestamp)
  }

  clear(): void {
    sessionStorage.removeItem(this.STORAGE_KEY)
    this.positionsSubject.next([])
    this.select(null)
  }

  private getSelectedTimestamp(): number | null {
    const raw = sessionStorage.getItem(this.SELECTED_KEY)
    if (!raw) return null

    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null

    return parsed
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
