import { Injectable, effect, inject, signal } from '@angular/core'

import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Popup from '@arcgis/core/widgets/Popup'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils'

import * as satellite from 'satellite.js'
import { SatellitesStoreService } from '../store/satellites-store'

type SceneViewElement = {
  viewOnReady?: (callback?: () => void, errback?: (error: Error) => void) => Promise<void>
  map?: { addMany?: (layers: unknown[]) => void }
  constraints?: unknown
  popup?: unknown
  environment?: unknown
}

@Injectable({
  providedIn: 'root',
})
export class SatellitesSceneControllerService {
  private isInitialized = false
  private readonly satellitesStoreService = inject(SatellitesStoreService)

  private readonly sceneEl = signal<SceneViewElement | null>(null)
  private readonly satelliteLayer = signal<GraphicsLayer | null>(null)
  private readonly satelliteTracks = signal<GraphicsLayer | null>(null)

  constructor () {
    effect(() => {
      const layer = this.satelliteLayer()
      const tracks = this.satelliteTracks()
      if (!layer || !tracks) return

      const selected = this.satellitesStoreService.selectedSatellites()
      layer.removeAll()
      tracks.removeAll()

      selected.forEach((s) => {
        const time = Date.now()
        const designator = s.line1.substring(9, 16)
        const launchYear = designator.substring(0, 2)
        const fullLaunchYear = Number(launchYear) >= 57 ? `19${launchYear}` : `20${launchYear}`
        const launchNum = Number(designator.substring(2, 5)).toString()
        const noradId = Number(s.line1.substring(3, 7))

        const satelliteLoc = this.getSatelliteLocation(new Date(time), s.line1, s.line2)
        if (!satelliteLoc) return

        const graphic = new Graphic({
          geometry: satelliteLoc,
          symbol: {
            type: 'point-3d',
            symbolLayers: [
              {
                type: 'icon',
                resource: {
                  href: 'https://developers.arcgis.com/javascript/latest/assets/sample-code/satellites-3d/satellite.png',
                },
                size: 24,
              },
            ],
          } as any,
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
                type: 'button',
                title: 'Show Satellite Track',
                id: 'track',
                className: 'esri-icon-globe',
              },
            ],
          },
        })

        layer.add(graphic)
      })
    })
  }

  async init (sceneEl: SceneViewElement) {
    if (this.isInitialized) return

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

    await sceneEl.viewOnReady?.()

    const satelliteLayer = new GraphicsLayer()
    const satelliteTracks = new GraphicsLayer()
    ;(satelliteLayer as any).elevationInfo = { mode: 'absolute-height' }
    ;(satelliteTracks as any).elevationInfo = { mode: 'absolute-height' }

    sceneEl.map?.addMany?.([satelliteLayer, satelliteTracks])

    reactiveUtils.watch(
      () => (sceneEl.popup as { selectedFeature?: unknown } | undefined)?.selectedFeature,
      () => {
        satelliteTracks.removeAll()
      },
    )

    ;(sceneEl.popup as { on?: (name: string, cb: (ev: any) => void) => void } | undefined)?.on?.(
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

    this.sceneEl.set(sceneEl)
    this.satelliteLayer.set(satelliteLayer)
    this.satelliteTracks.set(satelliteTracks)

    this.isInitialized = true
  }

  private getSatelliteLocation (
    date: Date,
    line1: string,
    line2: string,
  ): { type: 'point', x: number, y: number, z: number } | null {
    try {
      const satrec = (satellite as any).twoline2satrec(line1, line2)
      const pv = (satellite as any).propagate(
        satrec,
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      )

      const positionEci = pv?.position
      if (
        !positionEci ||
        typeof positionEci.x !== 'number' ||
        typeof positionEci.y !== 'number' ||
        typeof positionEci.z !== 'number'
      ) return null

      const gmst = (satellite as any).gstime_from_date(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      )

      const positionGd = (satellite as any).eci_to_geodetic(positionEci, gmst)
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
      }
    } catch {
      return null
    }
  }
}

