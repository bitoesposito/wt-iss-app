import { Injectable, computed, effect, inject, signal } from '@angular/core'

import { SatellitesTleService, TleSatellite } from '../services/satellites-tle.service'

@Injectable({
  providedIn: 'root',
})
export class SatellitesStoreService {
  private readonly tleService = inject(SatellitesTleService)
  private readonly STORAGE_KEY = 'satellites.tle.stations.v1'
  private readonly STORAGE_SELECTED_KEY = 'satellites.tle.selected.v1'

  readonly satellites = signal<TleSatellite[]>([])
  readonly isLoading = signal<boolean>(false)
  readonly loadError = signal<string | null>(null)

  // Selezione multipla (PrimeNG checkbox multiple)
  readonly selectedSatellites = signal<TleSatellite[]>([])

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
      this.selectedSatellites.set(this.readSelectedFromSession(cached))
    }

    effect(() => {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.satellites()))
    })

    effect(() => {
      const selectedNames = this.selectedSatellites().map((s) => s.name)
      sessionStorage.setItem(this.STORAGE_SELECTED_KEY, JSON.stringify(selectedNames))
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
      if (!this.selectedSatellites().length) {
        const iss = satellites.find((s) => s.name.toLowerCase().includes('iss'))
        this.selectedSatellites.set(iss ? [iss] : [])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore nel fetch dei TLE'
      this.loadError.set(message)
      this.satellites.set([])
      this.selectedSatellites.set([])
    } finally {
      this.isLoading.set(false)
    }
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

  private readSelectedFromSession (satellites: TleSatellite[]): TleSatellite[] {
    const raw = sessionStorage.getItem(this.STORAGE_SELECTED_KEY)
    if (!raw) return []

    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []

      const selectedNames = new Set(parsed.filter((v): v is string => typeof v === 'string'))
      return satellites.filter((s) => selectedNames.has(s.name))
    } catch {
      return []
    }
  }
}

