import { Injectable, computed, effect, inject, signal } from '@angular/core'

import { SatellitesTleService, TleSatellite } from '../services/satellites-tle.service'

@Injectable({
  providedIn: 'root',
})
export class SatellitesStoreService {
  private readonly tleService = inject(SatellitesTleService)
  private readonly STORAGE_KEY = 'satellites.'
  private readonly STORAGE_SELECTED_KEY = 'satellites.selected'

  readonly satellites = signal<TleSatellite[]>([])
  readonly isLoading = signal<boolean>(false)
  readonly loadError = signal<string | null>(null)

  // Selezione (salvata per nome, più stabile del binding ad oggetti)
  readonly selectedSatelliteNames = signal<string[]>([])

  readonly selectedSatellites = computed(() => {
    const selected = new Set(this.selectedSatelliteNames())
    return this.satellites().filter((s) => selected.has(s.name))
  })

  readonly selectedNoradIds = computed(() =>
    new Set(
      this.selectedSatellites()
        .map((s) => s.noradId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  )

  constructor () {
    const cached = this.readSatellitesFromSession()
    if (cached.length) {
      this.satellites.set(cached)
      this.selectedSatelliteNames.set(this.readSelectedNamesFromSession(cached))
    }

    effect(() => {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.satellites()))
    })

    effect(() => {
      sessionStorage.setItem(this.STORAGE_SELECTED_KEY, JSON.stringify(this.selectedSatelliteNames()))
    })
  }

  async loadStations (): Promise<void> {
    // Cache in-memory: se già caricato, non rifare fetch quando switchi vista.
    if (this.satellites().length) return
    if (this.isLoading()) return

    this.isLoading.set(true)
    this.loadError.set(null)

    try {
      const satellites = await this.tleService.fetchStationsTle()
      this.satellites.set(satellites)

      // Default UX: se non c'è già una selezione, preseleziona ISS se presente.
      if (!this.selectedSatelliteNames().length) {
        const iss = satellites.find((s) => s.name.toLowerCase().includes('iss'))
        this.selectedSatelliteNames.set(iss ? [iss.name] : [])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore nel fetch dei TLE'
      this.loadError.set(message)
      this.satellites.set([])
      this.selectedSatelliteNames.set([])
    } finally {
      this.isLoading.set(false)
    }
  }

  selectAll (): void {
    const allNames = this.satellites().map((s) => s.name)
    this.selectedSatelliteNames.set(allNames)
  }

  clearSelection (): void {
    this.selectedSatelliteNames.set([])
  }

  isSelected (name: string): boolean {
    return this.selectedSatelliteNames().includes(name)
  }

  setSelected (name: string, isSelected: boolean) {
    const current = new Set(this.selectedSatelliteNames())
    if (isSelected) current.add(name)
    else current.delete(name)
    this.selectedSatelliteNames.set(Array.from(current))
  }

  private readSatellitesFromSession (): TleSatellite[] {
    const raw = sessionStorage.getItem(this.STORAGE_KEY)
    if (!raw) return []

    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []

      return parsed.filter((s): s is TleSatellite => {
        if (!s || typeof s !== 'object') return false
        const c = s as Partial<TleSatellite>
        return (
          typeof c.name === 'string' &&
          typeof c.line1 === 'string' &&
          typeof c.line2 === 'string'
        )
      })
    } catch {
      return []
    }
  }

  private readSelectedNamesFromSession (satellites: TleSatellite[]): string[] {
    const raw = sessionStorage.getItem(this.STORAGE_SELECTED_KEY)
    if (!raw) return []

    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []

      const selectedNames = new Set(parsed.filter((v): v is string => typeof v === 'string'))
      const knownNames = new Set(satellites.map((s) => s.name))
      return Array.from(selectedNames).filter((name) => knownNames.has(name))
    } catch {
      return []
    }
  }
}

