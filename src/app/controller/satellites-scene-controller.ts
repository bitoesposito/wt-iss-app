import { Injectable, effect, inject, signal } from '@angular/core'

import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'

import { SatellitesStoreService } from '../store/satellites-store'
import { SatelliteOrbitService } from '../services/satellite-orbit.service'

type SceneMap = { addMany: (layers: unknown[]) => void }

type SceneGoTo = (target: unknown, options?: unknown) => Promise<unknown>

export type SatellitesSceneElement = {
  viewOnReady: () => Promise<void>
  map: SceneMap
  constraints?: unknown
  popup?: unknown
  environment?: unknown
  view?: { goTo?: SceneGoTo }
  goTo?: SceneGoTo
}

@Injectable({
  providedIn: 'root',
})
export class SatellitesSceneControllerService {
  private isInitialized = false
  private readonly satellitesStoreService = inject(SatellitesStoreService)
  private readonly satelliteOrbitService = inject(SatelliteOrbitService)

  private readonly sceneEl = signal<SatellitesSceneElement | null>(null)
  private readonly satelliteLayer = signal<GraphicsLayer | null>(null)

  constructor () {
    effect(() => {
      const sceneEl = this.sceneEl()
      const layer = this.satelliteLayer()
      if (!sceneEl || !layer) return

      const selected = this.satellitesStoreService.selectedSatellites()
      layer.removeAll()

      if (!selected.length) return

      let firstPointGeometry: Point | null = null

      for (const s of selected) {
        const time = Date.now()
        const designator = s.line1.substring(9, 16)
        const launchYear = designator.substring(0, 2)
        const fullLaunchYear = Number(launchYear) >= 57 ? `19${launchYear}` : `20${launchYear}`
        const launchNum = Number(designator.substring(2, 5)).toString()
        const noradId = Number(s.line1.substring(3, 7))

        const satelliteLoc = this.satelliteOrbitService.getSatelliteLocation(new Date(time), s.line1, s.line2)
        if (!satelliteLoc) continue

        const satellitePoint = new Point(satelliteLoc as any)

        if (!firstPointGeometry) {
          firstPointGeometry = satellitePoint
        }

        const graphic = new Graphic({
          geometry: satellitePoint,
          symbol: {
            type: 'simple-marker',
            color: [59, 130, 246],
            size: 10,
            outline: {
              color: [255, 255, 255],
              width: 2,
            },
          },
          attributes: {
            name: s.name,
            year: fullLaunchYear,
            id: noradId,
            number: launchNum,
            time,
            line1: s.line1,
            line2: s.line2,
          },
          popupTemplate: {
            title: '{name}',
            content: 'Launch number {number} of {year}',
          },
        })

        layer.add(graphic)
      }

      if (!firstPointGeometry) return

      const goToTarget = firstPointGeometry

      const goToPromise =
        sceneEl.goTo?.(goToTarget, { animate: true }) ??
        sceneEl.view?.goTo?.(goToTarget, { animate: true })

      goToPromise?.catch?.(() => {})
    })
  }

  async init (sceneEl: SatellitesSceneElement) {
    const prevSceneEl = this.sceneEl()
    if (this.isInitialized && prevSceneEl === sceneEl) return

    if (this.isInitialized && prevSceneEl !== sceneEl) {
      this.detach()
    }

    sceneEl.constraints = {
      altitude: { max: 12000000000 },
    }

    sceneEl.environment = {
      lighting: { type: 'virtual' },
    }

    await sceneEl.viewOnReady()

    const satelliteLayer = new GraphicsLayer({
      title: 'Satellites',
    })
    ;(satelliteLayer as any).elevationInfo = { mode: 'absolute-height' }
    sceneEl.map.addMany([satelliteLayer])

    this.sceneEl.set(sceneEl)
    this.satelliteLayer.set(satelliteLayer)

    this.isInitialized = true
  }

  detach () {
    this.sceneEl.set(null)
    this.satelliteLayer.set(null)
    this.isInitialized = false
  }

  focusSatellite (sat: { name: string, line1: string, line2: string }) {
    const sceneEl = this.sceneEl()
    const layer = this.satelliteLayer()
    if (!sceneEl || !layer) return

    const satelliteLoc = this.satelliteOrbitService.getSatelliteLocation(new Date(), sat.line1, sat.line2)
    if (!satelliteLoc) return

    const point = new Point(satelliteLoc as any)

    const layerGraphic = layer.graphics?.find?.((g: any) => g?.attributes?.name === sat.name) ?? null

    const popupGraphic =
      layerGraphic ??
      new Graphic({
        geometry: point,
        symbol: {
          type: 'simple-marker',
          color: [59, 130, 246],
          size: 10,
          outline: {
            color: [255, 255, 255],
            width: 2,
          },
        },
        attributes: {
          name: sat.name,
          line1: sat.line1,
          line2: sat.line2,
          time: Date.now(),
        },
        popupTemplate: {
          title: '{name}',
          content: 'Satellite position',
        },
      })

    const goToPromise =
      sceneEl.goTo?.(point, { animate: true }) ??
      sceneEl.view?.goTo?.(point, { animate: true })

    goToPromise
      ?.then?.(() => {
        const popup = sceneEl.popup as any
        popup?.open?.({
          features: [popupGraphic],
          location: point,
        })
      })
      ?.catch?.(() => {})
  }

}

