import { CUSTOM_ELEMENTS_SCHEMA, Component, OnDestroy } from '@angular/core'
import { Subscription, combineLatest, distinctUntilChanged, switchMap, timer } from 'rxjs'

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
})

export class MapComponent implements OnDestroy {
  // Ogni 10 secondi facciamo un fetch della posizione.
  private readonly FETCH_INTERVAL_MS = 10 * 1000

  // Stato locale (derivato dallo store) usato per render e focus.
  private positions: IssPosition[] = []
  private selectedTimestamp: number | null = null
  private graphics: MapGraphics | undefined
  private view: MapView | undefined
  private fetchSubscription: Subscription | undefined
  private storeSubscription: Subscription | undefined
  private selectionSubscription: Subscription | undefined

  constructor (
    private readonly issTrackerService: IssTrackerService,
    private readonly positionStoreService: PositionStoreService,
  ) {}

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

    this.graphics = graphics
    this.view = view
    this.startFetching()
    this.startRendering()
    this.startSelectionFocus()
  }

  ngOnDestroy () {
    this.fetchSubscription?.unsubscribe()
    this.storeSubscription?.unsubscribe()
    this.selectionSubscription?.unsubscribe()
  }

  // Evento emesso dal web component quando clicchi sulla view.
  // Usiamo hitTest per capire se hai cliccato uno dei nostri punti
  // e aggiornare `positions.selected` (quindi anche la sidebar).
  arcgisViewClick (event: unknown) {
    if (!this.view?.hitTest) return

    this.view.hitTest(event).then((hitTestResult) => {
      const timestamp = this.getTimestampFromHitTest(hitTestResult)
      this.positionStoreService.select(timestamp)
    }).catch(() => {})
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
    const latestTimestamp = this.positionStoreService.get()?.[0]?.timestamp
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

  private startRendering () {
    if (this.storeSubscription) return

    // Ogni cambiamento nello store forza un rerender coerente:
    // numero di card in sidebar === numero di punti sulla mappa.
    this.storeSubscription = combineLatest([
      this.positionStoreService.positions$,
      this.positionStoreService.selectedTimestamp$,
    ]).subscribe(([positions, selectedTimestamp]) => {
      this.positions = positions
      this.selectedTimestamp = selectedTimestamp
      this.renderPositions()
    })
  }

  private renderPositions () {
    if (!this.graphics) return
    this.graphics.removeAll?.()

    // Per ogni entry nello store creiamo un Graphic “plain object”.
    // Importante: non usiamo `new Graphic()` da @arcgis/core (evita mismatch classi).
    const graphics = this.positions.map((position, index) =>
      this.toGraphic(position, index),
    )

    if (this.graphics.addMany) {
      this.graphics.addMany(graphics)
      return
    }

    graphics.forEach((graphic) => this.graphics?.add(graphic))
  }

  private toGraphic (position: IssPosition, index: number) {
    const isLatest = index === 0
    const isSelected = this.selectedTimestamp === position.timestamp
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
        content: 'Posizione della ISS al <br /> <b>' + timestamp + '</b>',
      },
    }
  }

  private startSelectionFocus () {
    if (this.selectionSubscription) return

    // Quando la selezione cambia (es. click su card), centriamo la mappa sul punto.
    this.selectionSubscription = this.positionStoreService.selectedTimestamp$.pipe(
      distinctUntilChanged(),
    ).subscribe((timestamp) => {
      if (!timestamp) return

      const position = this.positions.find((p) => p.timestamp === timestamp)
      if (!position) return

      this.view?.goTo?.(
        {
          center: [position.longitude, position.latitude],
          zoom: 4,
        },
        { animate: true },
      ).catch(() => {})
    })
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
