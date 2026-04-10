import { useEffect, useRef, useState } from 'react'

import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import SpatialReference from '@arcgis/core/geometry/SpatialReference'
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine'

import {
  getArcgisMapFromElement,
  getArcgisViewFromElement,
} from '../types/arcgis-map'

type UseOrbitTrackerSketchParams = {
  sceneElement: HTMLElement | null
  sketchElement: HTMLElement | null
  bufferKm: number
}

export default function useOrbitTrackerSketch({
  sceneElement,
  sketchElement,
  bufferKm,
}: UseOrbitTrackerSketchParams) {
  const [point, setPoint] = useState<Point | null>(null)
  const [ready, setReady] = useState(false)

  const sketchLayerRef = useRef<GraphicsLayer | null>(null)
  const bufferLayerRef = useRef<GraphicsLayer | null>(null)
  const bufferKmRef = useRef(bufferKm)

  useEffect(() => {
    bufferKmRef.current = bufferKm
  }, [bufferKm])

  useEffect(() => {
    if (!sceneElement || !sketchElement) return

    let cancelled = false

    const init = async () => {
      while (!cancelled && !getArcgisMapFromElement(sceneElement)) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (cancelled) return

      const map = getArcgisMapFromElement(sceneElement)
      const view = getArcgisViewFromElement(sceneElement)
      if (!map || !view) return

      const sketchLayer = new GraphicsLayer({
        id: 'orbit-tracker-sketch',
        elevationInfo: { mode: 'on-the-ground' } as const,
      })
      const bufferLayer = new GraphicsLayer({
        id: 'orbit-tracker-buffer',
        elevationInfo: { mode: 'on-the-ground' } as const,
      })

      map.layers.add(bufferLayer as unknown)
      map.layers.add(sketchLayer as unknown)
      sketchLayerRef.current = sketchLayer
      bufferLayerRef.current = bufferLayer

      const sk = sketchElement as unknown as {
        layer?: unknown
        view?: unknown
        spatialReference?: unknown
      }
      sk.layer = sketchLayer
      sk.view = view
      sk.spatialReference = SpatialReference.WGS84

      sketchLayer.graphics.on('change', () => {
        const count = sketchLayer.graphics.length
        if (count > 1) {
          const last = sketchLayer.graphics.at(count - 1)
          for (let i = count - 2; i >= 0; i--) {
            const g = sketchLayer.graphics.at(i)
            if (g) sketchLayer.remove(g)
          }
          setPoint(last?.geometry?.type === 'point' ? (last.geometry as Point) : null)
          return
        }

        const first = sketchLayer.graphics.at(0)
        setPoint(first?.geometry?.type === 'point' ? (first.geometry as Point) : null)
      })

      setReady(true)
    }

    void init()

    return () => {
      cancelled = true
      const map = getArcgisMapFromElement(sceneElement)
      if (map && sketchLayerRef.current) map.layers.remove(sketchLayerRef.current as unknown)
      if (map && bufferLayerRef.current) map.layers.remove(bufferLayerRef.current as unknown)
      sketchLayerRef.current = null
      bufferLayerRef.current = null
      setPoint(null)
      setReady(false)
    }
  }, [sceneElement, sketchElement])

  useEffect(() => {
    const layer = bufferLayerRef.current
    if (!layer) return

    layer.removeAll()
    if (!point) return
    if (!Number.isFinite(bufferKmRef.current) || bufferKmRef.current <= 0) return

    const result = geometryEngine.geodesicBuffer(
      point as unknown as never,
      bufferKmRef.current,
      'kilometers',
    )
    const polygon = Array.isArray(result) ? result[0] : result
    if (!polygon) return

    layer.add(
      new Graphic({
        geometry: polygon,
        symbol: {
          type: 'simple-fill',
          color: [59, 130, 246, 0.08],
          outline: { color: [59, 130, 246, 0.6], width: 1.5 },
        } as const,
      }),
    )
  }, [point, bufferKm])

  const clearPoint = () => {
    sketchLayerRef.current?.removeAll()
    bufferLayerRef.current?.removeAll()
    setPoint(null)
  }

  return { point, ready, clearPoint }
}
