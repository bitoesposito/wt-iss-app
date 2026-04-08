import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, OnDestroy, effect, inject } from '@angular/core'

import { ViewModeStoreService } from '../../store/view-mode-store'
import { IssMapControllerService, IssMapView } from '../../controller/iss-map-controller'
import { SatellitesSceneControllerService, SatellitesSceneElement } from '../../controller/satellites-scene-controller'
import { SatelliteOrbitTracker } from '../widget/satellite-orbit-tracker/satellite-orbit-tracker';

type MapElement = {
	graphics?: unknown
	view?: IssMapView
}

type SceneElement = SatellitesSceneElement

@Component({
	selector: 'app-map',
	imports: [SatelliteOrbitTracker],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './map.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements OnDestroy {
	private readonly viewModeStoreService = inject(ViewModeStoreService)
	readonly viewMode = this.viewModeStoreService.viewMode

	private readonly issMapControllerService = inject(IssMapControllerService)
	private readonly satellitesSceneControllerService = inject(SatellitesSceneControllerService)

	private readonly viewModeEffect = effect(() => {
		const mode = this.viewMode()
		if (mode === 'iss') return

		// Quando si passa a 3D interrompiamo polling ISS e ripuliamo stato.
		this.issMapControllerService.detach()
	})

	arcgisViewReadyChange (event: unknown) {
		if (this.viewMode() !== 'iss') return

		const eventCandidate = event as { detail?: { view?: unknown }, target?: unknown }
		const viewOrMapEl = (eventCandidate?.detail?.view ?? eventCandidate?.target) as MapElement | undefined

		const graphics = viewOrMapEl?.graphics
		const view = viewOrMapEl?.view ?? (eventCandidate?.detail?.view as IssMapView | undefined)
		if (!graphics) return

		this.issMapControllerService.attach(graphics as any, view ?? null)
		this.issMapControllerService.startFetching()
	}

	arcgisViewClick (event: unknown) {
		if (this.viewMode() !== 'iss') return
		this.issMapControllerService.handleMapClick(event)
	}

	arcgisViewMouseWheel (event: unknown) {
		const detail = (event as { detail?: { stopPropagation?: () => void } } | null)?.detail
		detail?.stopPropagation?.()
	}

	arcgisViewDoubleClick (event: unknown) {
		const detail = (event as { detail?: { stopPropagation?: () => void } } | null)?.detail
		detail?.stopPropagation?.()
	}

	arcgisViewKeyDown (event: unknown) {
		const detail = (event as { detail?: { key?: string, stopPropagation?: () => void } } | null)?.detail
		if (!detail) return

		const key = detail.key
		if (key !== '+' && key !== '-') return

		detail.stopPropagation?.()
	}

	async arcgisSceneReadyChange (event: unknown) {
		if (this.viewMode() !== 'satellites') return

		const sceneEl = (event as { target?: unknown } | null)?.target as SceneElement | undefined
		if (!sceneEl) return

		await this.satellitesSceneControllerService.init(sceneEl)
	}

	ngOnDestroy () {
		this.issMapControllerService.detach()
	}
}

