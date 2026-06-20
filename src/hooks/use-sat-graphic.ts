import { useEffect, useRef, useState } from 'react'

import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import Polyline from '@arcgis/core/geometry/Polyline'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import SpatialReference from '@arcgis/core/geometry/SpatialReference'
import IconSymbol3DLayer from '@arcgis/core/symbols/IconSymbol3DLayer'
import PointSymbol3D from '@arcgis/core/symbols/PointSymbol3D'

import type { TleSatellite } from '../types'
import {
  getArcgisMapFromElement,
  getArcgisViewFromElement,
} from '../types/arcgis-map'
import { propagateTleToGeodetic } from '../lib/satellite/propagate'
import { getSatelliteKey } from '../lib/satellite/satellite-utils'
import {
  ACTIVE_BLUE,
  MARKER_SIZE_SAT,
  SAT_FOCUS_ZOOM,
  SAT_RENDER_CHUNK_SIZE,
  TRACK_BLUE,
  TRACK_STEP_SECONDS,
  TRACK_WINDOW_MINUTES,
  WHITE_OUTLINE,
} from '../lib/map-style'

type UseSatGraphicLayerParams = {
  mapElement: HTMLElement | null
  positions: TleSatellite[]
  activeSatelliteKey?: string | null
}

// Cede il controllo al event-loop tra un chunk e l'altro: con selezioni grandi
// la UI resta reattiva invece di bloccarsi per migliaia di propagazioni SGP4.
const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

const satellitePoint = (params: {
  line1: string
  line2: string
  date: Date
}): Point | null => {
  const geodetic = propagateTleToGeodetic(params)
  if (!geodetic) return null
  return new Point({
    longitude: geodetic.longitude,
    latitude: geodetic.latitude,
    z: geodetic.altitudeMeters,
  })
}

const createSatelliteGraphic = (params: {
  satellite: TleSatellite
  point: Point
  timestamp: number
}) => {
  const { satellite: sat, point, timestamp } = params
  const timestampLabel = new Date(timestamp).toLocaleString()

  const symbol = new PointSymbol3D({
    symbolLayers: [
      new IconSymbol3DLayer({
        resource: { primitive: 'circle' },
        size: MARKER_SIZE_SAT,
        material: { color: ACTIVE_BLUE },
        outline: { color: WHITE_OUTLINE, size: 1 },
      }),
    ],
  })

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

const buildTrackGraphic = (sat: TleSatellite, now: number): Graphic | null => {
  const points: Array<[number, number, number]> = []

  for (
    let seconds = 0;
    seconds <= TRACK_WINDOW_MINUTES * 60;
    seconds += TRACK_STEP_SECONDS
  ) {
    const point = satellitePoint({
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
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(z)
    ) {
      continue
    }

    points.push([lon, lat, z])
  }

  if (points.length < 2) return null

  return new Graphic({
    geometry: new Polyline({
      paths: [points],
      spatialReference: SpatialReference.WGS84,
    }),
    symbol: {
      type: 'simple-line',
      color: TRACK_BLUE,
      width: 1.5,
    } as const,
    attributes: { name: sat.name, noradId: sat.noradId },
  })
}

export default function useSatGraphicLayer({
  mapElement,
  positions,
  activeSatelliteKey,
}: UseSatGraphicLayerParams) {
  const positionsLayerRef = useRef<GraphicsLayer | null>(null)
  const tracksLayerRef = useRef<GraphicsLayer | null>(null)
  const [layerVersion, setLayerVersion] = useState(0)

  // 1) Crea e aggancia i layer alla mappa appena l'elemento ArcGIS è pronto.
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

      if (!isCancelled) setLayerVersion((v) => v + 1)
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

  // 2) Marker posizioni: ricostruiti a chunk per non bloccare il main thread.
  useEffect(() => {
    const positionsLayer = positionsLayerRef.current
    if (!positionsLayer) return

    let cancelled = false
    positionsLayer.removeAll()

    const now = Date.now()
    const date = new Date(now)

    const run = async () => {
      for (let i = 0; i < positions.length; i += SAT_RENDER_CHUNK_SIZE) {
        if (cancelled) return

        const chunk = positions.slice(i, i + SAT_RENDER_CHUNK_SIZE)
        const graphics: Graphic[] = []

        for (const sat of chunk) {
          const point = satellitePoint({
            line1: sat.line1,
            line2: sat.line2,
            date,
          })
          if (!point) continue
          graphics.push(createSatelliteGraphic({ satellite: sat, point, timestamp: now }))
        }

        if (cancelled) return
        positionsLayer.addMany(graphics)
        await yieldToEventLoop()
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [positions, layerVersion])

  // 3) Centra la vista sul satellite attivo.
  useEffect(() => {
    if (!mapElement) return
    if (!activeSatelliteKey) return

    const sat = positions.find((s) => getSatelliteKey(s) === activeSatelliteKey)
    if (!sat) return

    const point = satellitePoint({
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
        await view.goTo({ center: point, zoom: SAT_FOCUS_ZOOM })
      } catch {
        return
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [activeSatelliteKey, mapElement, positions, layerVersion])

  // 4) Tracce orbitali (finestra di 90 min): ricostruite a chunk.
  useEffect(() => {
    const tracksLayer = tracksLayerRef.current
    if (!tracksLayer) return

    let cancelled = false
    tracksLayer.removeAll()

    const now = Date.now()

    const run = async () => {
      for (let i = 0; i < positions.length; i += SAT_RENDER_CHUNK_SIZE) {
        if (cancelled) return

        const chunk = positions.slice(i, i + SAT_RENDER_CHUNK_SIZE)
        const graphics: Graphic[] = []

        for (const sat of chunk) {
          const graphic = buildTrackGraphic(sat, now)
          if (graphic) graphics.push(graphic)
        }

        if (cancelled) return
        tracksLayer.addMany(graphics)
        await yieldToEventLoop()
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [positions, layerVersion])
}
