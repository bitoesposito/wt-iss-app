import { useEffect, useRef, useState } from 'react'

import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import PointSymbol3D from '@arcgis/core/symbols/PointSymbol3D'
import ObjectSymbol3DLayer from '@arcgis/core/symbols/ObjectSymbol3DLayer'
import IconSymbol3DLayer from '@arcgis/core/symbols/IconSymbol3DLayer'

import type { IssPosition } from '../types'
import { getArcgisMapFromElement, waitForView } from '../types/arcgis-map'
import { getIssKey } from '../lib/iss-utils'
import {
  ACTIVE_BLUE,
  DEFAULT_ISS_ALTITUDE_KM,
  ISS_MODEL_HEIGHT_M,
  MUTED_GRAY_3D,
  TRAIL_SIZE_ACTIVE_3D,
  TRAIL_SIZE_DEFAULT_3D,
  WHITE_OUTLINE_SOFT,
} from '../lib/map-style'

type UseIssSceneGraphicParams = {
  sceneElement: HTMLElement | null
  positions: IssPosition[]
  activeIssPositionKey: string | null
  follow: boolean
}

const getAltitudeMeters = (position: IssPosition) =>
  (position.altitude ?? DEFAULT_ISS_ALTITUDE_KM) * 1000

const createDefaultTrailSymbol = () =>
  new PointSymbol3D({
    symbolLayers: [
      new IconSymbol3DLayer({
        resource: { primitive: 'circle' },
        size: TRAIL_SIZE_DEFAULT_3D,
        material: { color: MUTED_GRAY_3D },
        outline: { color: WHITE_OUTLINE_SOFT, size: 0.5 },
      }),
    ],
  })

const createActiveTrailSymbol = () =>
  new PointSymbol3D({
    symbolLayers: [
      new IconSymbol3DLayer({
        resource: { primitive: 'circle' },
        size: TRAIL_SIZE_ACTIVE_3D,
        material: { color: ACTIVE_BLUE },
        outline: { color: WHITE_OUTLINE_SOFT, size: 0.5 },
      }),
    ],
  })

const createIssModelGraphic = (position: IssPosition) => {
  return new Graphic({
    geometry: new Point({
      longitude: position.longitude,
      latitude: position.latitude,
      z: getAltitudeMeters(position),
    }),
    symbol: new PointSymbol3D({
      symbolLayers: [
        new ObjectSymbol3DLayer({
          resource: { href: '/3d/iss-model.glb' },
          height: ISS_MODEL_HEIGHT_M,
        }),
      ],
    }),
    attributes: { issKey: getIssKey(position), isLatest: true },
    popupTemplate: {
      title: 'ISS - Posizione attuale',
      content:
        `Latitudine: <b>${position.latitude.toFixed(4)}</b><br/>` +
        `Longitudine: <b>${position.longitude.toFixed(4)}</b><br/>` +
        `Altitudine: <b>${(position.altitude ?? DEFAULT_ISS_ALTITUDE_KM).toFixed(1)} km</b><br/>` +
        `Data: <b>${new Date(position.timestamp * 1000).toLocaleString()}</b>`,
    },
  })
}

const createTrailGraphic = (position: IssPosition) => {
  return new Graphic({
    geometry: new Point({
      longitude: position.longitude,
      latitude: position.latitude,
      z: getAltitudeMeters(position),
    }),
    symbol: createDefaultTrailSymbol(),
    attributes: { issKey: getIssKey(position), isLatest: false },
    popupTemplate: {
      title: 'Posizione precedente',
      content:
        `Latitudine: <b>${position.latitude.toFixed(4)}</b><br/>` +
        `Longitudine: <b>${position.longitude.toFixed(4)}</b><br/>` +
        `Altitudine: <b>${(position.altitude ?? DEFAULT_ISS_ALTITUDE_KM).toFixed(1)} km</b><br/>` +
        `Data: <b>${new Date(position.timestamp * 1000).toLocaleString()}</b>`,
    },
  })
}

export default function useIssSceneGraphic({
  sceneElement,
  positions,
  activeIssPositionKey,
  follow,
}: UseIssSceneGraphicParams) {
  const layerRef = useRef<GraphicsLayer | null>(null)
  const graphicsByKeyRef = useRef(new Map<string, Graphic>())
  const lastCenteredKeyRef = useRef<string | null>(null)
  const prevActiveKeyRef = useRef<string | null>(null)
  const [layerVersion, setLayerVersion] = useState(0)

  useEffect(() => {
    if (!sceneElement) return

    let cancelled = false

    const init = async () => {
      if (layerRef.current) return

      while (!cancelled && !getArcgisMapFromElement(sceneElement)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (cancelled) return

      const map = getArcgisMapFromElement(sceneElement)
      if (!map) return

      const layer = new GraphicsLayer({ id: 'iss-3d-positions' })
      ;(layer as unknown as { elevationInfo: unknown }).elevationInfo = {
        mode: 'absolute-height',
      }
      map.layers.add(layer as unknown)
      layerRef.current = layer
      if (!cancelled) setLayerVersion((v) => v + 1)
    }

    void init()

    return () => {
      cancelled = true
      const map = getArcgisMapFromElement(sceneElement)
      if (map && layerRef.current) {
        map.layers.remove(layerRef.current as unknown)
      }
      layerRef.current = null
      lastCenteredKeyRef.current = null
    }
  }, [sceneElement])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    layer.removeAll()
    graphicsByKeyRef.current.clear()
    prevActiveKeyRef.current = null

    for (let i = positions.length - 1; i >= 0; i -= 1) {
      const position = positions[i]
      if (!position) continue

      const issKey = getIssKey(position)
      const graphic =
        i === 0 ? createIssModelGraphic(position) : createTrailGraphic(position)

      graphicsByKeyRef.current.set(issKey, graphic)
      layer.add(graphic)
    }
  }, [positions, layerVersion])

  useEffect(() => {
    const prev = prevActiveKeyRef.current
    prevActiveKeyRef.current = activeIssPositionKey

    if (prev) {
      const prevGraphic = graphicsByKeyRef.current.get(prev)
      if (prevGraphic && !prevGraphic.attributes?.isLatest) {
        prevGraphic.symbol = createDefaultTrailSymbol()
      }
    }

    if (activeIssPositionKey) {
      const activeGraphic = graphicsByKeyRef.current.get(activeIssPositionKey)
      if (activeGraphic && !activeGraphic.attributes?.isLatest) {
        activeGraphic.symbol = createActiveTrailSymbol()
      }
    }
  }, [activeIssPositionKey])

  useEffect(() => {
    if (!sceneElement) return
    if (!follow) return
    const latest = positions[0]
    if (!latest) return

    const latestKey = getIssKey(latest)
    if (lastCenteredKeyRef.current === latestKey) return

    let cancelled = false

    const run = async () => {
      const view = await waitForView(sceneElement, () => cancelled)
      if (!view) return

      lastCenteredKeyRef.current = latestKey

      try {
        await view.goTo?.(
          { center: [latest.longitude, latest.latitude], zoom: 4, tilt: 45 },
          { animate: false } as unknown,
        )
      } catch {}
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [sceneElement, positions, layerVersion, follow])

  useEffect(() => {
    if (!sceneElement) return

    let cancelled = false

    const run = async () => {
      const view = await waitForView(sceneElement, () => cancelled)
      if (!view) return

      if (activeIssPositionKey) {
        const graphic = graphicsByKeyRef.current.get(activeIssPositionKey)
        if (!graphic) return

        try {
          await view.openPopup?.({
            features: [graphic],
            location: graphic.geometry,
          })
        } catch {}
      } else {
        try {
          await view.closePopup?.()
        } catch {}
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [sceneElement, activeIssPositionKey])
}

