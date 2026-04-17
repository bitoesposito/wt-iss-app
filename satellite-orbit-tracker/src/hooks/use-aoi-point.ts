import { useEffect, useRef, useState, useCallback } from 'react'
import type { JimuMapView } from 'jimu-arcgis'

import GraphicsLayer from 'esri/layers/GraphicsLayer'
import Graphic from 'esri/Graphic'
import Point from 'esri/geometry/Point'
import * as geometryEngine from 'esri/geometry/geometryEngine'
import SimpleMarkerSymbol from 'esri/symbols/SimpleMarkerSymbol'
import SimpleFillSymbol from 'esri/symbols/SimpleFillSymbol'

const POINT_LAYER_ID = 'orbit-tracker-aoi-point'
const BUFFER_LAYER_ID = 'orbit-tracker-aoi-buffer'

const pointSymbol = new SimpleMarkerSymbol({
  style: 'circle',
  color: [220, 38, 38, 0.85],
  size: 10,
  outline: { color: [255, 255, 255, 0.9], width: 1.5 },
})

const bufferSymbol = new SimpleFillSymbol({
  color: [220, 38, 38, 0.08],
  outline: { color: [220, 38, 38, 0.5], width: 1.5 },
})

interface UseAoiPointParams {
  jimuMapView: JimuMapView | null
  bufferKm: number
}

interface UseAoiPointResult {
  point: Point | null
  placing: boolean
  layersReady: boolean
  startPlacing: () => void
  clearPoint: () => void
}

/**
 * Hook that manages a "pick a point on the map" interaction plus its
 * associated geodesic buffer visualization.
 *
 * Responsibilities:
 *  - Create two dedicated graphics layers on the target map.
 *  - Let the caller enter a "placing" mode where the next map click is
 *    captured and stored as the AOI center.
 *  - Keep the buffer preview in sync with the current point and radius.
 *  - Clean up layers, click handlers, and cursor overrides on unmount.
 */
export default function useAoiPoint({
  jimuMapView,
  bufferKm,
}: UseAoiPointParams): UseAoiPointResult {
  const [point, setPoint] = useState<Point | null>(null)
  const [placing, setPlacing] = useState(false)
  const [layersReady, setLayersReady] = useState(false)

  const pointLayerRef = useRef<GraphicsLayer | null>(null)
  const bufferLayerRef = useRef<GraphicsLayer | null>(null)
  const clickHandlerRef = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    if (!jimuMapView) return
    let cancelled = false

    jimuMapView.whenJimuMapViewLoaded().then(() => {
      if (cancelled) return
      const map = jimuMapView.view.map

      const existingPt = map.findLayerById(POINT_LAYER_ID)
      const existingBuf = map.findLayerById(BUFFER_LAYER_ID)
      if (existingPt) map.remove(existingPt)
      if (existingBuf) map.remove(existingBuf)

      const bufferLayer = new GraphicsLayer({ id: BUFFER_LAYER_ID })
      const pointLayer = new GraphicsLayer({ id: POINT_LAYER_ID })
      map.add(bufferLayer)
      map.add(pointLayer)

      bufferLayerRef.current = bufferLayer
      pointLayerRef.current = pointLayer
      setLayersReady(true)
    })

    return () => {
      cancelled = true
      const map = jimuMapView?.view?.map
      if (map) {
        if (pointLayerRef.current) map.remove(pointLayerRef.current)
        if (bufferLayerRef.current) map.remove(bufferLayerRef.current)
      }
      pointLayerRef.current = null
      bufferLayerRef.current = null
      setLayersReady(false)

      if (clickHandlerRef.current) {
        clickHandlerRef.current.remove()
        clickHandlerRef.current = null
      }
    }
  }, [jimuMapView])

  const startPlacing = useCallback(() => {
    if (!jimuMapView?.view) return
    setPlacing(true)
    jimuMapView.view.container.style.cursor = 'crosshair'

    if (clickHandlerRef.current) clickHandlerRef.current.remove()

    clickHandlerRef.current = jimuMapView.view.on('click', (event) => {
      event.stopPropagation()

      const mapPoint = event.mapPoint
      if (!mapPoint) return

      setPoint(
        new Point({
          longitude: mapPoint.longitude,
          latitude: mapPoint.latitude,
          spatialReference: { wkid: 4326 },
        }),
      )
      setPlacing(false)
      jimuMapView.view.container.style.cursor = ''

      clickHandlerRef.current?.remove()
      clickHandlerRef.current = null
    })
  }, [jimuMapView])

  /**
   * Render the current point and the buffer preview. The effect owns
   * both graphic layers fully, removing any previous graphics before
   * adding new ones, so repeated runs stay idempotent.
   */
  useEffect(() => {
    if (!layersReady) return
    const pointLayer = pointLayerRef.current
    const bufferLayer = bufferLayerRef.current
    if (!pointLayer || !bufferLayer) return

    pointLayer.removeAll()
    bufferLayer.removeAll()
    if (!point) return

    pointLayer.add(new Graphic({ geometry: point, symbol: pointSymbol }))

    if (bufferKm > 0) {
      const buffer = geometryEngine.geodesicBuffer(
        point as __esri.Geometry,
        bufferKm,
        'kilometers',
      )
      if (buffer) {
        bufferLayer.add(
          new Graphic({
            geometry: buffer as __esri.Geometry,
            symbol: bufferSymbol,
          }),
        )
      }
    }
  }, [point, bufferKm, layersReady])

  const clearPoint = useCallback(() => {
    setPoint(null)
    setPlacing(false)

    clickHandlerRef.current?.remove()
    clickHandlerRef.current = null

    if (jimuMapView?.view) {
      jimuMapView.view.container.style.cursor = ''
    }
  }, [jimuMapView])

  return { point, placing, layersReady, startPlacing, clearPoint }
}
