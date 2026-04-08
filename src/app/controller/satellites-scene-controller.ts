import { Injectable, effect, inject, signal } from '@angular/core'

import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import Popup from '@arcgis/core/widgets/Popup'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils'

import * as satellite from 'satellite.js'
import { SatellitesStoreService } from '../store/satellites-store'

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

  private readonly sceneEl = signal<SatellitesSceneElement | null>(null)
  private readonly satelliteLayer = signal<GraphicsLayer | null>(null)
  private readonly satelliteTracks = signal<GraphicsLayer | null>(null)
  private cleanupHandles: Array<{ remove?: () => void }> = []

  constructor () {
    effect(() => {
      const sceneEl = this.sceneEl()
      const layer = this.satelliteLayer()
      const tracks = this.satelliteTracks()
      if (!sceneEl || !layer || !tracks) return

      const selected = this.satellitesStoreService.selectedSatellites()
      layer.removeAll()
      tracks.removeAll()

      if (!selected.length) return

      let firstPointGeometry: Point | null = null

      for (const s of selected) {
        const time = Date.now()
        const designator = s.line1.substring(9, 16)
        const launchYear = designator.substring(0, 2)
        const fullLaunchYear = Number(launchYear) >= 57 ? `19${launchYear}` : `20${launchYear}`
        const launchNum = Number(designator.substring(2, 5)).toString()
        const noradId = Number(s.line1.substring(3, 7))

        const satelliteLoc = this.getSatelliteLocation(new Date(time), s.line1, s.line2)
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
            actions: [
              {
                type: 'button' as const,
                title: 'Show Satellite Track',
                id: 'track',
                className: 'esri-icon-globe',
              },
            ],
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

    sceneEl.popup = new Popup({
      dockEnabled: true,
      dockOptions: {
        breakpoint: false,
      },
    })

    sceneEl.environment = {
      lighting: { type: 'virtual' },
    }

    await sceneEl.viewOnReady()

    const satelliteLayer = new GraphicsLayer()
    const satelliteTracks = new GraphicsLayer()
    ;(satelliteLayer as any).elevationInfo = { mode: 'absolute-height' }
    ;(satelliteTracks as any).elevationInfo = { mode: 'absolute-height' }
    sceneEl.map.addMany([satelliteLayer, satelliteTracks])

    this.sceneEl.set(sceneEl)
    this.satelliteLayer.set(satelliteLayer)
    this.satelliteTracks.set(satelliteTracks)

    const watchHandle = reactiveUtils.watch(
      () => (sceneEl.popup as { selectedFeature?: unknown } | undefined)?.selectedFeature,
      () => {
        satelliteTracks.removeAll()
      },
    )
    this.cleanupHandles.push(watchHandle as any)

    const popupOnHandle = (sceneEl.popup as { on?: (name: string, cb: (ev: any) => void) => unknown } | undefined)?.on?.(
      'trigger-action',
      (popupEvent: any) => {
        if (popupEvent?.action?.id !== 'track') return
        satelliteTracks.removeAll()

        const selected = (sceneEl.popup as any)?.selectedFeature as any
        if (!selected?.attributes) return

        const trackFeatures: Array<[number, number, number]> = []
        for (let m = 0; m < 60 * 24; m++) {
          const loc = this.getSatelliteLocation(
            new Date(selected.attributes.time + m * 1000 * 60),
            selected.attributes.line1,
            selected.attributes.line2,
          )
          if (!loc) continue
          trackFeatures.push([loc.x, loc.y, loc.z])
        }

        const track = new Graphic({
          geometry: {
            type: 'polyline',
            paths: [trackFeatures],
            hasZ: true,
            spatialReference: { wkid: 4326 },
          },
          symbol: {
            type: 'line-3d',
            symbolLayers: [
              {
                type: 'line',
                material: { color: [192, 192, 192, 0.5] },
                size: 3,
              },
            ],
          },
        })

        satelliteTracks.add(track)
      },
    )
    if (popupOnHandle && typeof popupOnHandle === 'object') {
      this.cleanupHandles.push(popupOnHandle as any)
    }

    this.isInitialized = true
  }

  detach () {
    for (const h of this.cleanupHandles) {
      h?.remove?.()
    }
    this.cleanupHandles = []

    this.sceneEl.set(null)
    this.satelliteLayer.set(null)
    this.satelliteTracks.set(null)
    this.isInitialized = false
  }

  focusSatellite (sat: { name: string, line1: string, line2: string }) {
    const sceneEl = this.sceneEl()
    const layer = this.satelliteLayer()
    if (!sceneEl || !layer) return

    const satelliteLoc = this.getSatelliteLocation(new Date(), sat.line1, sat.line2)
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
          actions: [
            {
              type: 'button' as const,
              title: 'Show Satellite Track',
              id: 'track',
              className: 'esri-icon-globe',
            },
          ],
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

  private getSatelliteLocation (
    date: Date,
    line1: string,
    line2: string,
  ): { type: 'point', x: number, y: number, z: number, hasZ: true, spatialReference: { wkid: 4326 } } | null {
    try {
      const satrec = (satellite as any).twoline2satrec(line1, line2)

      // satellite.js v7: propagate(satrec, Date) -> { position, velocity } | null
      const pv = (satellite as any).propagate(satrec, date)
      if (pv === null) return null

      const positionEci = pv.position
      if (!positionEci) return null

      const gmst = (satellite as any).gstime(date)
      const positionGd = (satellite as any).eciToGeodetic(positionEci, gmst)
      const rad2deg = 180 / Math.PI

      let longitude = positionGd.longitude
      let latitude = positionGd.latitude
      const height = positionGd.height
      if (Number.isNaN(longitude) || Number.isNaN(latitude) || Number.isNaN(height)) return null

      while (longitude < -Math.PI) longitude += 2 * Math.PI
      while (longitude > Math.PI) longitude -= 2 * Math.PI

      return {
        type: 'point',
        x: rad2deg * longitude,
        y: rad2deg * latitude,
        z: height * 1000,
        hasZ: true,
        spatialReference: { wkid: 4326 },
      }
    } catch {
      return null
    }
  }
}

