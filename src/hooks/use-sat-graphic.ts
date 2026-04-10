import { useEffect, useRef } from 'react'

import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import Polyline from '@arcgis/core/geometry/Polyline'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import * as satellite from 'satellite.js'

import type { TleSatellite } from '../types'
import {
  getArcgisMapFromElement,
  getArcgisViewFromElement,
} from '../types/arcgis-map'

type UseSatGraphicLayerParams = {
  mapElement: HTMLElement | null
  positions: TleSatellite[]
  activeSatelliteKey?: string | null
}

// Converte un TLE (line1/line2) in un Point (lon/lat/alt) valido per ArcGIS.
// Se la propagazione fallisce, ritorna `null` e quel satellite viene saltato.
const getSatellitePointFromTle = (params: {
  line1: string
  line2: string
  date: Date
}): Point | null => {
  const { line1, line2, date } = params

  let satrec: ReturnType<typeof satellite.twoline2satrec>
  try {
    satrec = satellite.twoline2satrec(line1, line2)
  } catch {
    return null
  }

  const positionAndVelocity = satellite.propagate(satrec, date)
  const positionEci = positionAndVelocity.position

  if (
    !positionEci ||
    typeof positionEci.x !== 'number' ||
    typeof positionEci.y !== 'number' ||
    typeof positionEci.z !== 'number'
  ) {
    return null
  }

  const gmst = satellite.gstime(date)
  const positionGd = satellite.eciToGeodetic(positionEci, gmst)

  if (
    typeof positionGd.longitude !== 'number' ||
    typeof positionGd.latitude !== 'number' ||
    typeof positionGd.height !== 'number'
  ) {
    return null
  }

  const longitude = satellite.degreesLong(positionGd.longitude)
  const latitude = satellite.degreesLat(positionGd.latitude)
  const altitudeMeters = positionGd.height * 1000

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(altitudeMeters)
  ) {
    return null
  }

  return new Point({
    longitude,
    latitude,
    z: altitudeMeters,
  })
}

const createSatelliteGraphic = (params: {
  satellite: TleSatellite
  point: Point
  timestamp: number
}) => {
  const { satellite: sat, point, timestamp } = params
  const timestampLabel = new Date(timestamp).toLocaleString()

  const symbol = {
    type: 'point-3d',
    symbolLayers: [
      {
        type: 'icon',
        resource: { primitive: 'circle' },
        size: 10,
        material: { color: [59, 130, 246, 0.9] },
        outline: { color: [255, 255, 255, 0.9], size: 1 },
      },
    ],
  } as const

  const popupTemplate = {
    title: '{name}',
    content:
      'NORAD: <b>{noradId}</b><br/>' +
      'Posizione: <b>{longitude}</b>, <b>{latitude}</b><br/>' +
      'Altitudine: <b>{altitudeKilometers} km</b><br/>' +
      'Data: <b>{timestampLabel}</b>',
  } as const

  return new Graphic({
    geometry: point,
    symbol,
    attributes: {
      name: sat.name,
      noradId: sat.noradId,
      longitude: Number(point.longitude?.toFixed(6)),
      latitude: Number(point.latitude?.toFixed(6)),
      altitudeKilometers: Math.round(((point.z ?? 0) / 1000) * 100) / 100,
      timestampLabel,
      line1: sat.line1,
      line2: sat.line2,
    },
    popupTemplate,
  })
}

export default function useSatGraphicLayer({
  mapElement,
  positions,
  activeSatelliteKey,
}: UseSatGraphicLayerParams) {
  const positionsLayerRef = useRef<GraphicsLayer | null>(null)
  const tracksLayerRef = useRef<GraphicsLayer | null>(null)

  // 1) Crea e aggancia il layer alla mappa appena l’elemento ArcGIS è pronto.
  useEffect(() => {
    if (!mapElement) return

    let isCancelled = false

    const ensureLayer = async () => {
      if (positionsLayerRef.current && tracksLayerRef.current) return

      // Aspettiamo che `mapElement.map` (o `mapElement.view.map`) sia disponibile.
      while (!isCancelled && !getArcgisMapFromElement(mapElement)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      if (isCancelled) return

      const map = getArcgisMapFromElement(mapElement)
      if (!map) return

      const tracksLayer = new GraphicsLayer({ id: 'satellite-tracks' })
      const positionsLayer = new GraphicsLayer({ id: 'satellite-positions' })

      map.layers.add(tracksLayer as unknown)
      map.layers.add(positionsLayer as unknown)

      tracksLayerRef.current = tracksLayer
      positionsLayerRef.current = positionsLayer
    }

    void ensureLayer()

    return () => {
      isCancelled = true

      const map = getArcgisMapFromElement(mapElement)
      const positionsLayer = positionsLayerRef.current
      const tracksLayer = tracksLayerRef.current

      if (map && positionsLayer) {
        map.layers.remove(positionsLayer as unknown)
      }

      if (map && tracksLayer) {
        map.layers.remove(tracksLayer as unknown)
      }

      positionsLayerRef.current = null
      tracksLayerRef.current = null
    }
  }, [mapElement])

  // 2) Ogni volta che cambiano i TLE, ricreiamo i Graphic e li mettiamo nel layer.
  useEffect(() => {
    const positionsLayer = positionsLayerRef.current
    const tracksLayer = tracksLayerRef.current
    if (!positionsLayer || !tracksLayer) return

    positionsLayer.removeAll()
    tracksLayer.removeAll()

    const now = Date.now()
    const date = new Date(now)

    for (const sat of positions) {
      const point = getSatellitePointFromTle({
        line1: sat.line1,
        line2: sat.line2,
        date,
      })

      if (!point) continue

      const graphic = createSatelliteGraphic({
        satellite: sat,
        point,
        timestamp: now,
      })

      positionsLayer.add(graphic)
    }
  }, [positions])

  useEffect(() => {
    if (!mapElement) return
    if (!activeSatelliteKey) return

    const getSatelliteKey = (sat: TleSatellite) => {
      return `${sat.noradId ?? 'no-norad'}-${sat.name}`
    }

    const sat = positions.find((s) => getSatelliteKey(s) === activeSatelliteKey)
    if (!sat) return

    const point = getSatellitePointFromTle({
      line1: sat.line1,
      line2: sat.line2,
      date: new Date(),
    })
    if (!point) return

    let isCancelled = false

    const run = async () => {
      while (!isCancelled && !getArcgisViewFromElement(mapElement)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      if (isCancelled) return

      const view = getArcgisViewFromElement(mapElement)
      if (!view?.goTo) return

      try {
        await view.goTo(
          {
            center: point,
            zoom: 4,
          }
        )
      } catch {
        return
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [activeSatelliteKey, mapElement, positions])

  useEffect(() => {
    const tracksLayer = tracksLayerRef.current
    if (!tracksLayer) return

    tracksLayer.removeAll()

    const TRACK_WINDOW_MINUTES = 90
    const STEP_SECONDS = 120
    const now = Date.now()

    for (const sat of positions) {
      const points: Array<[number, number, number]> = []

      for (
        let seconds = 0;
        seconds <= TRACK_WINDOW_MINUTES * 60;
        seconds += STEP_SECONDS
      ) {
        const point = getSatellitePointFromTle({
          line1: sat.line1,
          line2: sat.line2,
          date: new Date(now + seconds * 1000),
        })

        if (!point) continue

        const lon = point.longitude
        const lat = point.latitude
        const z = point.z ?? 0

        if (
          typeof lon !== 'number' ||
          typeof lat !== 'number' ||
          typeof z !== 'number' ||
          !Number.isFinite(lon) ||
          !Number.isFinite(lat) ||
          !Number.isFinite(z)
        ) {
          continue
        }

        points.push([lon, lat, z])
      }

      if (points.length < 2) continue

      const polyline = new Polyline({
        paths: [points],
        spatialReference: { wkid: 4326 } as unknown,
      })

      const symbol = {
        type: 'simple-line',
        color: [255, 255, 255, 0.33],
        width: 1.5,
      } as const

      tracksLayer.add(
        new Graphic({
          geometry: polyline,
          symbol,
          attributes: {
            name: sat.name,
            noradId: sat.noradId,
          },
        }),
      )
    }
  }, [positions])
}
