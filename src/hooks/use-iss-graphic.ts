import { useEffect, useMemo, useRef } from 'react'

import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'

import type { IssPosition } from '../types'
import {
  getArcgisMapFromElement,
  getArcgisViewFromElement,
} from '../types/arcgis-map'

type UseIssGraphicLayerParams = {
  mapElement: HTMLElement | null
  positions: IssPosition[]
  activeIssPositionKey: string | null
  onSelectIssPositionKey: (key: string | null) => void
}

const POPUP_DEBOUNCE_MS = 120
const DEFAULT_ZOOM = 3

const getIssKey = (position: IssPosition) => {
  return `${position.timestamp}-${position.latitude}-${position.longitude}`
}

const createGraphic = (params: {
  position: IssPosition
  issKey: string
  isLatest: boolean
  isActive: boolean
}) => {
  const { position, issKey, isLatest, isActive } = params

  const geometry = new Point({
    longitude: position.longitude,
    latitude: position.latitude,
  })

  const isGreenLatest = isLatest && !isActive

  const size = isActive ? 12 : isGreenLatest ? 12 : 8
  const color = isActive
    ? ([59, 130, 246, 1] as const)
    : isGreenLatest
      ? ([34, 197, 94, 1] as const)
      : ([156, 163, 175, 0.7] as const)

  const symbol = {
    type: 'simple-marker',
    style: 'circle',
    size,
    color,
    outline: {
      color: [255, 255, 255, 1],
      width: 1,
    },
  } as const

  const popupTemplate = {
    title: isLatest ? 'Posizione attuale' : 'Posizione precedente',
    content: `${position.latitude}, ${position.longitude}<br/>${new Date(
      position.timestamp * 1000,
    ).toLocaleString()}`
  } as const

  return new Graphic({
    geometry,
    symbol,
    attributes: {
      issKey,
      timestamp: position.timestamp,
      latitude: position.latitude,
      longitude: position.longitude,
    },
    popupTemplate,
  })
}

export default function useIssGraphicLayer({
  mapElement,
  positions,
  activeIssPositionKey,
  onSelectIssPositionKey,
}: UseIssGraphicLayerParams) {
  const layerRef = useRef<GraphicsLayer | null>(null)
  const graphicsByKeyRef = useRef(new Map<string, Graphic>())
  const openPopupTimeoutRef = useRef<number | null>(null)
  const lastCenteredKeyRef = useRef<string | null>(null)
  const lastActiveCenteredKeyRef = useRef<string | null>(null)
  const navigationLockedRef = useRef(false)

  const activeKey = useMemo(() => {
    return activeIssPositionKey ?? null
  }, [activeIssPositionKey])

  useEffect(() => {
    if (!mapElement) return

    let isCancelled = false

    const ensureLayer = async () => {
      if (layerRef.current) return

      while (!isCancelled && !getArcgisMapFromElement(mapElement)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      if (isCancelled) return

      const map = getArcgisMapFromElement(mapElement)
      if (!map) return

      const layer = new GraphicsLayer({ id: 'iss-positions' })
      map.layers.add(layer as unknown)
      layerRef.current = layer
    }

    void ensureLayer()

    return () => {
      isCancelled = true

      const map = getArcgisMapFromElement(mapElement)
      const layer = layerRef.current

      if (map && layer) {
        map.layers.remove(layer as unknown)
      }

      layerRef.current = null
    }
  }, [mapElement])

  useEffect(() => {
    if (!mapElement) return
    if (navigationLockedRef.current) return

    const view = getArcgisViewFromElement(mapElement)
    if (!view) return

    const maybe = view as unknown as {
      navigation?: {
        actionMap?: Record<string, unknown>
        mouseWheelZoomEnabled?: boolean
        browserTouchPanEnabled?: boolean
        momentumEnabled?: boolean
      }
      constraints?: {
        minZoom?: number
        maxZoom?: number
      }
    }

    if (maybe.navigation) {
      if (typeof maybe.navigation.mouseWheelZoomEnabled === 'boolean') {
        maybe.navigation.mouseWheelZoomEnabled = false
      }

      maybe.navigation.actionMap = {
        ...(maybe.navigation.actionMap ?? {}),
        mouseWheel: 'none',
        doubleClick: 'none',
        dragSecondary: 'none',
      }

      if (typeof maybe.navigation.browserTouchPanEnabled === 'boolean') {
        maybe.navigation.browserTouchPanEnabled = false
      }

      if (typeof maybe.navigation.momentumEnabled === 'boolean') {
        maybe.navigation.momentumEnabled = false
      }
    }

    maybe.constraints = {
      ...(maybe.constraints ?? {}),
      maxZoom: DEFAULT_ZOOM,
    }

    navigationLockedRef.current = true
  }, [mapElement])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    layer.removeAll()
    graphicsByKeyRef.current.clear()

    for (let index = positions.length - 1; index >= 0; index -= 1) {
      const position = positions[index]
      if (!position) continue

      const issKey = getIssKey(position)
      const graphic = createGraphic({
        position,
        issKey,
        isLatest: index === 0,
        isActive: issKey === activeKey,
      })
      graphicsByKeyRef.current.set(issKey, graphic)
      layer.add(graphic)
    }
  }, [activeKey, positions])

  useEffect(() => {
    if (!mapElement) return
    if (activeKey) return
    const latest = positions[0]
    if (!latest) return

    const latestKey = getIssKey(latest)
    if (lastCenteredKeyRef.current === latestKey) return

    let isCancelled = false

    const run = async () => {
      while (!isCancelled && !getArcgisViewFromElement(mapElement)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      if (isCancelled) return

      const view = getArcgisViewFromElement(mapElement)
      if (!view?.goTo) return

      try {
        if (typeof (view as unknown as { when?: () => Promise<unknown> }).when === 'function') {
          await (view as unknown as { when: () => Promise<unknown> }).when()
        }
      } catch {
        return
      }

      try {
        lastCenteredKeyRef.current = latestKey
        await view.goTo(
          {
            center: [latest.longitude, latest.latitude],
            zoom: DEFAULT_ZOOM,
          },
          { animate: false } as unknown,
        )
      } catch {
        return
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [activeKey, mapElement, positions])

  useEffect(() => {
    if (!mapElement) return
    if (!activeKey) return

    if (lastActiveCenteredKeyRef.current === activeKey) return

    const graphic = graphicsByKeyRef.current.get(activeKey)
    if (!graphic) return

    let isCancelled = false

    const run = async () => {
      while (!isCancelled && !getArcgisViewFromElement(mapElement)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      if (isCancelled) return

      const view = getArcgisViewFromElement(mapElement)
      if (!view?.goTo) return

      try {
        if (typeof (view as unknown as { when?: () => Promise<unknown> }).when === 'function') {
          await (view as unknown as { when: () => Promise<unknown> }).when()
        }
      } catch {
        return
      }

      try {
        lastActiveCenteredKeyRef.current = activeKey
        await view.goTo(
          {
            center: graphic.geometry,
          },
          { animate: false } as unknown,
        )
      } catch {
        return
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [activeKey, mapElement])

  useEffect(() => {
    if (!mapElement) return

    const view = getArcgisViewFromElement(mapElement)
    if (!view) return

    if (openPopupTimeoutRef.current !== null) {
      window.clearTimeout(openPopupTimeoutRef.current)
      openPopupTimeoutRef.current = null
    }

    if (!activeKey) {
      if (view.closePopup) {
        void view.closePopup()
        return
      }

      return
    }

    openPopupTimeoutRef.current = window.setTimeout(() => {
      const graphic = graphicsByKeyRef.current.get(activeKey)
      if (!graphic) return

      const options = {
        features: [graphic],
        location: graphic.geometry,
      }

      if (view.openPopup) {
        void view.openPopup(options)
        return
      }
    }, POPUP_DEBOUNCE_MS)

    return () => {
      if (openPopupTimeoutRef.current !== null) {
        window.clearTimeout(openPopupTimeoutRef.current)
        openPopupTimeoutRef.current = null
      }
    }
  }, [activeKey, mapElement])

  useEffect(() => {
    if (!mapElement) return

    const view = getArcgisViewFromElement(mapElement)
    if (!view?.on || !view.hitTest) return

    const handleClick = async (event: unknown) => {
      const hitTestResult = await view.hitTest?.(event)
      if (!hitTestResult || typeof hitTestResult !== 'object') {
        onSelectIssPositionKey(null)
        return
      }

      const maybe = hitTestResult as {
        results?: Array<{
          graphic?: {
            attributes?: {
              issKey?: string
              timestamp?: number
              latitude?: number
              longitude?: number
            }
          }
        }>
      }

      const first = maybe.results?.[0]?.graphic?.attributes
      if (!first) {
        onSelectIssPositionKey(null)
        return
      }

      if (typeof first.issKey === 'string') {
        onSelectIssPositionKey(first.issKey)
        return
      }

      if (
        typeof first.timestamp !== 'number' ||
        typeof first.latitude !== 'number' ||
        typeof first.longitude !== 'number'
      ) {
        onSelectIssPositionKey(null)
        return
      }

      onSelectIssPositionKey(
        `${first.timestamp}-${first.latitude}-${first.longitude}`,
      )
    }

    const handler = view.on('click', handleClick)
    return () => handler.remove()
  }, [mapElement, onSelectIssPositionKey])
}
