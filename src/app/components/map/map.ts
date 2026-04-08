import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, OnDestroy, effect, inject, signal } from '@angular/core'
import { Subscription, switchMap, timer } from 'rxjs'

import { IssTrackerService } from '../../services/iss-tracker'
import { IssPosition } from '../../interfaces/position.interface'
import { PositionStoreService } from '../../services/position-store'

type MapGraphics = {
	add: (graphic: unknown) => unknown
	addMany?: (graphics: unknown[]) => void
	removeAll?: () => void
}

type HitTestResult = {
	results?: Array<{
		graphic?: { attributes?: Record<string, unknown> }
	}>
}

type MapView = {
	// Usato per centrare la mappa su una posizione selezionata.
	goTo?: (target: unknown, options?: unknown) => Promise<unknown>

	// Usato per aprire il popup sul punto selezionato.
	openPopup?: (options?: unknown) => Promise<void>

	// Usato per chiudere il popup (es. hover cambia selezione).
	closePopup?: () => Promise<void>

	// Usato per intercettare click sulla mappa.
	on?: (
		eventName: string,
		handler: (event: unknown) => void,
	) => { remove: () => void }

	// Usato per capire quale graphic è stato cliccato.
	hitTest?: (event: unknown) => Promise<HitTestResult>
}

@Component({
  selector: 'app-map',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class MapComponent implements OnDestroy {
  // Ogni 10 secondi facciamo un fetch della posizione.
  private readonly FETCH_INTERVAL_MS = 10 * 1000

  // Stato locale (derivato dallo store) usato per render e focus.
  private readonly positions = signal<IssPosition[]>([])
  private readonly selectedTimestamp = signal<number | null>(null)
  private readonly graphics = signal<MapGraphics | null>(null)
  private readonly view = signal<MapView | null>(null)
  private readonly graphicByTimestamp = signal<Map<number, unknown>>(new Map())
  private fetchSubscription: Subscription | undefined

  private readonly issTrackerService = inject(IssTrackerService)
  private readonly positionStoreService = inject(PositionStoreService)

  // Store → stato locale → render (mappa coerente con sidebar).
  private readonly renderEffect = effect(() => {
    const graphics = this.graphics()
    if (!graphics) return

    this.positions.set(this.positionStoreService.positions())
    this.selectedTimestamp.set(this.positionStoreService.selectedTimestamp())

    graphics.removeAll?.()

    const newGraphics = this.positions().map((position, index) =>
      this.toGraphic(position, index),
    )

    const byTimestamp = new Map<number, unknown>()
    this.positions().forEach((position, index) => {
      byTimestamp.set(position.timestamp, newGraphics[index])
    })
    this.graphicByTimestamp.set(byTimestamp)

    if (graphics.addMany) {
      graphics.addMany(newGraphics)
      return
    }

    newGraphics.forEach((graphic) => graphics.add(graphic))
  })

  // Selezione → focus mappa
  private readonly focusEffect = effect(() => {
    const view = this.view()
    if (!view) return

    const timestamp = this.positionStoreService.selectedTimestamp()
    if (!timestamp) {
      const closePromise = view.closePopup?.()
      closePromise?.catch(() => {})
      return
    }
    const intent = this.positionStoreService.selectionIntent()

    const position = this.positionStoreService.positions().find((p) => p.timestamp === timestamp)
    if (!position) return

    const graphic = this.graphicByTimestamp().get(timestamp)

    if (intent !== 'click') {
      const closePromise = view.closePopup?.()
      closePromise?.catch(() => {})
    }

    const goToPromise = view.goTo?.(
      {
        center: [position.longitude, position.latitude],
      },
      { animate: true },
    )

    goToPromise?.then(() => {
      if (intent !== 'click') return
      if (!graphic) return

      view.openPopup?.({
        features: [graphic],
        location: (graphic as { geometry?: unknown } | undefined)?.geometry,
      })
    })?.catch(() => {})
  })

  // Questo evento viene emesso dal web component ArcGIS quando la view è pronta.
  // Da qui iniziamo:
  // - il fetch periodico (che salva nello store)
  // - il render dei punti leggendo dallo store
  // - la selezione (sidebar → mappa e mappa → sidebar)
  arcgisViewReadyChange (event: unknown) {
    const eventCandidate = event as { detail?: { view?: unknown }, target?: unknown }
    const viewOrMapEl = eventCandidate?.detail?.view ?? eventCandidate?.target

    const graphics = (viewOrMapEl as { graphics?: MapGraphics })?.graphics
    const view =
      (eventCandidate?.detail?.view as MapView) ??
      ((eventCandidate?.target as { view?: MapView } | undefined)?.view)

    if (!graphics) return

    this.graphics.set(graphics)
    this.view.set(view ?? null)
    this.startFetching()
  }

  ngOnDestroy () {
    this.fetchSubscription?.unsubscribe()
  }

  // Evento emesso dal web component quando clicchi sulla view.
  // Usiamo hitTest per capire se hai cliccato uno dei nostri punti
  // e aggiornare `positions.selected` (quindi anche la sidebar).
  arcgisViewClick (event: unknown) {
    const view = this.view()
    if (!view?.hitTest) return

    view.hitTest(event).then((hitTestResult) => {
      const timestamp = this.getTimestampFromHitTest(hitTestResult)
      this.positionStoreService.select(timestamp, 'map')
    }).catch(() => {})
  }

  arcgisViewMouseWheel (event: unknown) {
    // Disabilita lo zoom via rotella (ma lascia intatto il goTo programmatico).
    const detail = (event as { detail?: { stopPropagation?: () => void } } | null)?.detail
    detail?.stopPropagation?.()
  }

  arcgisViewDoubleClick (event: unknown) {
    // Disabilita lo zoom su doppio click.
    const detail = (event as { detail?: { stopPropagation?: () => void } } | null)?.detail
    detail?.stopPropagation?.()
  }

  arcgisViewKeyDown (event: unknown) {
    // Disabilita lo zoom da tastiera (+ / -).
    const detail = (event as { detail?: { key?: string, stopPropagation?: () => void } } | null)?.detail
    if (!detail) return

    const key = detail.key
    if (key !== '+' && key !== '-') return

    detail.stopPropagation?.()
  }

  private startFetching () {
    if (this.fetchSubscription) return

    const initialDelayMs = this.getInitialDelayMs()

    // Il service salva nello store tramite tap() → sidebar e mappa si aggiornano da positions$.
    this.fetchSubscription = timer(initialDelayMs, this.FETCH_INTERVAL_MS).pipe(
      switchMap(() => this.issTrackerService.fetchPosition()),
    ).subscribe()
  }

  private getInitialDelayMs () {
    // Allineiamo il fetch al prossimo “slot” da 10 secondi basandoci
    // sull’ultimo timestamp persistito.
    const latestTimestamp = this.positionStoreService.latestTimestamp()
    if (!latestTimestamp) return 0

    const nowSec = Math.floor(Date.now() / 1000)
    const secondsSinceLatest = nowSec - latestTimestamp

    // Se il dato è "nel futuro" (clock skew), fetch subito.
    if (secondsSinceLatest < 0) return 0

    // Se è già passato >= 10s dall'ultimo dato, fetch subito.
    if (secondsSinceLatest >= 10) return 0

    // Altrimenti aspetta fino al prossimo slot dei 10 secondi:
    // es: ultimo=00:00:00, ora=00:00:01 -> attesa 9s (fino a 00:00:10)
    const delaySec = 10 - secondsSinceLatest
    return delaySec * 1000
  }

  private toGraphic (position: IssPosition, index: number) {
    const isLatest = index === 0
    const isSelected = this.selectedTimestamp() === position.timestamp
    const timestamp = new Date(position.timestamp * 1000).toLocaleString()

    return {
      geometry: {
        type: 'point',
        longitude: position.longitude,
        latitude: position.latitude,
      },
      symbol: {
        type: 'simple-marker',
        color: isSelected ? [59, 130, 246] : isLatest ? [0, 255, 122] : [148, 163, 184],
        size: isSelected ? 14 : isLatest ? 12 : 8,
        outline: {
          color: [255, 255, 255],
          width: 2,
        }
      },
      attributes: {
        name: isSelected ? 'ISS (selezionata)' : isLatest ? 'ISS (attuale)' : 'ISS',
        timestamp: position.timestamp
      },
      popupTemplate: {
        title: '{name}',
        content: 'Posizione della ISS al: <br /> <b>' + timestamp + '</b>',
      },
    }
  }

  private getTimestampFromHitTest (hitTestResult: HitTestResult): number | null {
    const results = hitTestResult.results ?? []

    for (const result of results) {
      const attributes = result.graphic?.attributes
      const rawTimestamp = attributes?.['timestamp']

      const timestamp = typeof rawTimestamp === 'number'
        ? rawTimestamp
        : Number(rawTimestamp)

      if (Number.isFinite(timestamp)) return timestamp
    }

    return null
  }
}
