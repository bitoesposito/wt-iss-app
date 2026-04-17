import { useEffect, useMemo, useRef, useState } from 'react'
import type { JimuMapView } from 'jimu-arcgis'

import GraphicsLayer from 'esri/layers/GraphicsLayer'
import Graphic from 'esri/Graphic'
import Polyline from 'esri/geometry/Polyline'
import SimpleMarkerSymbol from 'esri/symbols/SimpleMarkerSymbol'
import SimpleLineSymbol from 'esri/symbols/SimpleLineSymbol'

import {
  computeSatellitePoint,
  getSatelliteKey,
  type TleSatellite,
} from 'widgets/shared-code/satellite-core'

const POSITIONS_LAYER_ID = 'satellite-positions'
const TRACKS_LAYER_ID = 'satellite-tracks'
const TRACK_WINDOW_MINUTES = 90
const TRACK_STEP_SECONDS = 120

const positionSymbol = new SimpleMarkerSymbol({
  style: 'circle',
  color: [59, 130, 246, 0.85],
  size: 8,
  outline: { color: [255, 255, 255, 0.9], width: 1 },
})

const trackSymbol = new SimpleLineSymbol({
  color: [59, 130, 246, 0.33],
  width: 1.5,
})

interface UseSatGraphicLayerParams {
  jimuMapView: JimuMapView | null
  selectedSatellites: TleSatellite[]
  activeSatelliteKey: string | null
  tick: number
}

/**
 * Build a popup template that is safe to share across all positions. The
 * ArcGIS popup templating performs its own field substitution, so we do
 * not interpolate the satellite name directly into the markup.
 */
const POSITION_POPUP_TEMPLATE: __esri.PopupTemplateProperties = {
  title: '{name}',
  content:
    'NORAD: <b>{noradId}</b><br/>' +
    'Lon: <b>{longitude}</b>, Lat: <b>{latitude}</b><br/>' +
    'Alt: <b>{altitudeKm} km</b>',
}

/**
 * Manage the pair of graphics layers (positions, orbital tracks) used to
 * visualize a selection of satellites on a `JimuMapView`.
 *
 * The hook is split into three concerns:
 *  1. Lazily create (and tear down) the two layers when the map view
 *     becomes available.
 *  2. Refresh sub-satellite point graphics whenever the selection or the
 *     animation `tick` changes.
 *  3. Recompute the 90-minute orbital track when the selection changes.
 *     Tracks are explicitly excluded from the `tick` dependency because
 *     re-rendering them every few seconds is both pointless (they barely
 *     drift in that window) and expensive.
 */
export default function useSatGraphicLayer({
  jimuMapView,
  selectedSatellites,
  activeSatelliteKey,
  tick,
}: UseSatGraphicLayerParams): void {
  const positionsLayerRef = useRef<GraphicsLayer | null>(null)
  const tracksLayerRef = useRef<GraphicsLayer | null>(null)
  const [layersReady, setLayersReady] = useState(false)

  useEffect(() => {
    if (!jimuMapView) return

    let cancelled = false

    jimuMapView.whenJimuMapViewLoaded().then(() => {
      if (cancelled) return
      const map = jimuMapView.view.map

      const existingPos = map.findLayerById(POSITIONS_LAYER_ID)
      const existingTrk = map.findLayerById(TRACKS_LAYER_ID)
      if (existingPos) map.remove(existingPos)
      if (existingTrk) map.remove(existingTrk)

      const tracksLayer = new GraphicsLayer({ id: TRACKS_LAYER_ID })
      const positionsLayer = new GraphicsLayer({ id: POSITIONS_LAYER_ID })
      map.add(tracksLayer)
      map.add(positionsLayer)

      tracksLayerRef.current = tracksLayer
      positionsLayerRef.current = positionsLayer
      setLayersReady(true)
    })

    return () => {
      cancelled = true
      const map = jimuMapView?.view?.map
      if (map) {
        if (positionsLayerRef.current) map.remove(positionsLayerRef.current)
        if (tracksLayerRef.current) map.remove(tracksLayerRef.current)
      }
      positionsLayerRef.current = null
      tracksLayerRef.current = null
      setLayersReady(false)
    }
  }, [jimuMapView])

  useEffect(() => {
    if (!layersReady) return
    const layer = positionsLayerRef.current
    if (!layer) return

    layer.removeAll()
    const now = new Date()

    for (const sat of selectedSatellites) {
      const point = computeSatellitePoint(sat, now, { includeAltitude: true })
      if (!point) continue

      layer.add(
        new Graphic({
          geometry: point,
          symbol: positionSymbol,
          attributes: {
            name: sat.name,
            noradId: sat.noradId,
            longitude: Number(point.longitude?.toFixed(6)),
            latitude: Number(point.latitude?.toFixed(6)),
            altitudeKm: Math.round(((point.z ?? 0) / 1000) * 100) / 100,
          },
          popupTemplate: POSITION_POPUP_TEMPLATE,
        }),
      )
    }
  }, [selectedSatellites, layersReady, tick])

  /**
   * Track samples are computed at selection time only. We memoize the
   * selection identity via `getSatelliteKey` so identical arrays do not
   * trigger recomputation when React returns a new reference.
   */
  const selectionSignature = useMemo(
    () => selectedSatellites.map(getSatelliteKey).join('|'),
    [selectedSatellites],
  )

  useEffect(() => {
    if (!layersReady) return
    const layer = tracksLayerRef.current
    if (!layer) return

    layer.removeAll()
    const nowMs = Date.now()

    for (const sat of selectedSatellites) {
      const paths: number[][] = []
      for (let seconds = 0; seconds <= TRACK_WINDOW_MINUTES * 60; seconds += TRACK_STEP_SECONDS) {
        const point = computeSatellitePoint(
          sat,
          new Date(nowMs + seconds * 1000),
          { includeAltitude: true },
        )
        if (!point) continue
        paths.push([point.longitude, point.latitude, point.z ?? 0])
      }
      if (paths.length < 2) continue

      layer.add(
        new Graphic({
          geometry: new Polyline({
            paths: [paths],
            spatialReference: { wkid: 4326 },
          }),
          symbol: trackSymbol,
          attributes: { name: sat.name, noradId: sat.noradId },
        }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionSignature, layersReady])

  useEffect(() => {
    if (!jimuMapView?.view || !activeSatelliteKey) return

    const sat = selectedSatellites.find((s) => getSatelliteKey(s) === activeSatelliteKey)
    if (!sat) return

    const point = computeSatellitePoint(sat, new Date(), { includeAltitude: true })
    if (!point) return

    jimuMapView.view.goTo({ center: point, zoom: 4 }).catch(() => undefined)
  }, [activeSatelliteKey, jimuMapView, selectedSatellites])
}
