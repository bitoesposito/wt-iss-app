/** @jsx jsx */
import { jsx, urlUtils, type AllWidgetProps } from 'jimu-core'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { type JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'

import GraphicsLayer from 'esri/layers/GraphicsLayer'
import Graphic from 'esri/Graphic'
import Point from 'esri/geometry/Point'
import SimpleMarkerSymbol from 'esri/symbols/SimpleMarkerSymbol'
import PointSymbol3D from 'esri/symbols/PointSymbol3D'
import ObjectSymbol3DLayer from 'esri/symbols/ObjectSymbol3DLayer'

import { fetchJsonWithTimeout } from 'widgets/shared-code/satellite-core'

import type { IMConfig } from '../config'
import t from './translations/default'

import '@esri/calcite-components/components/calcite-action-bar'
import '@esri/calcite-components/components/calcite-action'

const LAYER_2D_ID = 'iss-tracker-2d'
const LAYER_3D_ID = 'iss-tracker-3d'
const DEFAULT_ALTITUDE_KM = 408
const MIN_REFRESH_MS = 1000
const DEFAULT_MAX_POSITIONS = 300
const ISS_MODEL_HEIGHT_M = 300_000

/** 2D zoom level used by the locate action (country-scale framing). */
const LOCATE_ZOOM_2D = 4
/** 3D camera distance (meters) used by the locate action. */
const LOCATE_DISTANCE_3D = 6_000_000

const styles = {
  root: {
    width: '100%',
    height: '100%',
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontWeight: 600 },
  meta: { fontSize: 12, opacity: 0.7 },
  error: { fontSize: 12, color: 'var(--calcite-color-status-danger, #d9534f)' },
  coords: { fontSize: 12 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  hint: { fontSize: 12, opacity: 0.7 },
} as const

/**
 * Minimal shape returned by the ISS telemetry API. All numeric fields are
 * parsed defensively because the remote payload is outside our control.
 */
interface IssPosition {
  latitude: number
  longitude: number
  altitude: number
  timestamp: number
}

/**
 * Raw payload returned by the ISS tracking endpoint. Fields are optional
 * to force the caller to validate each coordinate.
 */
interface IssApiResponse {
  latitude?: number | string
  longitude?: number | string
  altitude?: number | string
}

const markerSymbol2d = new SimpleMarkerSymbol({
  style: 'circle',
  color: [59, 130, 246, 0.85],
  size: 8,
  outline: { color: [255, 255, 255, 0.9], width: 1 },
})

/**
 * Look up a `GraphicsLayer` on the given map by id, or create and attach
 * one on the fly. Centralizing the pattern keeps the 2D and 3D flows
 * identical and avoids duplicating defensive checks.
 *
 * @param jmv - Loaded `JimuMapView` to attach the layer to.
 * @param id - Stable identifier used to look up the layer on remount.
 * @param title - Human-readable title shown in the layer list.
 * @param elevationMode - Optional elevation mode. `undefined` for 2D maps.
 */
const getOrCreateGraphicsLayer = (
  jmv: JimuMapView,
  id: string,
  title: string,
  elevationMode?: __esri.GraphicElevationInfo['mode'],
): GraphicsLayer => {
  const existing = jmv.view.map.findLayerById(id) as GraphicsLayer | undefined
  if (existing) return existing

  const opts: __esri.GraphicsLayerProperties = { id, title }
  if (elevationMode) opts.elevationInfo = { mode: elevationMode }

  const layer = new GraphicsLayer(opts)
  jmv.view.map.add(layer)
  return layer
}

/**
 * Parse a raw ISS API response into the strongly-typed `IssPosition`.
 * Returns `null` when mandatory latitude/longitude are missing or not
 * finite, so the caller can surface a "bad payload" error state.
 *
 * @param data - Raw JSON payload from the ISS endpoint.
 */
const parseIssResponse = (data: IssApiResponse): IssPosition | null => {
  const latitude = Number(data?.latitude)
  const longitude = Number(data?.longitude)
  const altitude = Number(data?.altitude ?? DEFAULT_ALTITUDE_KM)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return {
    latitude,
    longitude,
    altitude: Number.isFinite(altitude) ? altitude : DEFAULT_ALTITUDE_KM,
    timestamp: Date.now(),
  }
}

/**
 * ISS Tracker widget: polls a public ISS endpoint on a configurable
 * interval and plots the current position on a 2D map and a 3D scene.
 *
 * Design notes:
 *  - Positions that are not currently rendered live in a `ref`, not in
 *    React state, because only the latest sample is shown and keeping
 *    the full history in state would cause unnecessary re-renders.
 *  - All network activity is guarded by an `AbortController` so unmounts
 *    and interval ticks cannot leak requests or race `setState` calls.
 */
export default function Widget(props: AllWidgetProps<IMConfig>): React.ReactElement {
  const { config, useMapWidgetIds } = props
  const map2dWidgetId = useMapWidgetIds?.[0]
  const map3dWidgetId = config?.sceneWidgetId || undefined

  const issModelUrl = useMemo(
    () => `${urlUtils.getFixedRootPath()}widgets/iss-tracker/dist/runtime/assets/iss-model.glb`,
    [],
  )

  const issSymbol3d = useMemo(
    () =>
      new PointSymbol3D({
        symbolLayers: [
          new ObjectSymbol3DLayer({
            resource: { href: issModelUrl },
            height: ISS_MODEL_HEIGHT_M,
          }),
        ],
      }),
    [issModelUrl],
  )

  const [latestPosition, setLatestPosition] = useState<IssPosition | null>(null)
  const [sampleCount, setSampleCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const layer2dRef = useRef<GraphicsLayer | null>(null)
  const layer3dRef = useRef<GraphicsLayer | null>(null)
  const issGraphic3dRef = useRef<Graphic | null>(null)
  const jmv2dRef = useRef<JimuMapView | null>(null)
  const jmv3dRef = useRef<JimuMapView | null>(null)

  const handle2dViewChange = useCallback((jmv: JimuMapView) => {
    if (!jmv) return
    jmv2dRef.current = jmv
    jmv.whenJimuMapViewLoaded().then(() => {
      layer2dRef.current = getOrCreateGraphicsLayer(jmv, LAYER_2D_ID, 'ISS Positions')
    })
  }, [])

  const handle3dViewChange = useCallback((jmv: JimuMapView) => {
    if (!jmv) return
    jmv3dRef.current = jmv
    jmv.whenJimuMapViewLoaded().then(() => {
      layer3dRef.current = getOrCreateGraphicsLayer(
        jmv,
        LAYER_3D_ID,
        'ISS 3D Model',
        'absolute-height',
      )
      issGraphic3dRef.current = null
    })
  }, [])

  /**
   * Push a new breadcrumb point on the 2D layer. The layer is evicted
   * past `maxPositionCount` so long sessions don't grow unbounded.
   */
  const addPointTo2d = useCallback(
    (pos: IssPosition, maxPositionCount: number) => {
      const layer = layer2dRef.current
      if (!layer) return

      layer.add(
        new Graphic({
          geometry: new Point({
            longitude: pos.longitude,
            latitude: pos.latitude,
            spatialReference: { wkid: 4326 },
          }),
          symbol: markerSymbol2d,
          attributes: { timestamp: pos.timestamp },
        }),
      )

      const overflow = layer.graphics.length - maxPositionCount
      if (overflow > 0) {
        layer.graphics.splice(0, overflow)
      }
    },
    [],
  )

  /**
   * Move the single 3D ISS graphic to the new position, or create it on
   * the first sample. We never add more than one 3D graphic because the
   * model is expensive and only the current location is meaningful in 3D.
   */
  const updateIssModel = useCallback(
    (pos: IssPosition) => {
      const layer = layer3dRef.current
      if (!layer) return

      const point = new Point({
        longitude: pos.longitude,
        latitude: pos.latitude,
        z: pos.altitude * 1000,
        spatialReference: { wkid: 4326 },
      })

      if (issGraphic3dRef.current) {
        issGraphic3dRef.current.geometry = point
        return
      }

      const graphic = new Graphic({ geometry: point, symbol: issSymbol3d })
      layer.add(graphic)
      issGraphic3dRef.current = graphic
    },
    [issSymbol3d],
  )

  useEffect(() => {
    const fetchUrl = config?.fetchUrl
    if (!fetchUrl) return

    const intervalMs = Math.max(MIN_REFRESH_MS, config?.refreshInterval ?? 10_000)
    const maxPositions = config?.maxPositionCount ?? DEFAULT_MAX_POSITIONS
    const abortController = new AbortController()
    let disposed = false

    const pollOnce = async (): Promise<void> => {
      if (disposed) return
      setIsFetching(true)
      try {
        const payload = await fetchJsonWithTimeout<IssApiResponse>(fetchUrl, {
          signal: abortController.signal,
        })
        if (disposed) return

        const pos = parseIssResponse(payload)
        if (!pos) {
          setError(t.invalidPayload)
          return
        }

        addPointTo2d(pos, maxPositions)
        updateIssModel(pos)
        setLatestPosition(pos)
        setSampleCount((prev) => prev + 1)
        setError(null)
      } catch (err) {
        if (disposed || abortController.signal.aborted) return
        setError(err instanceof Error ? err.message : t.unknownError)
      } finally {
        if (!disposed) setIsFetching(false)
      }
    }

    void pollOnce()
    const timerId = window.setInterval(() => void pollOnce(), intervalMs)

    return () => {
      disposed = true
      abortController.abort()
      window.clearInterval(timerId)
    }
  }, [config?.fetchUrl, config?.refreshInterval, config?.maxPositionCount, addPointTo2d, updateIssModel])

  const handleClear = useCallback(() => {
    setLatestPosition(null)
    setSampleCount(0)
    setError(null)
    layer2dRef.current?.removeAll()
    layer3dRef.current?.removeAll()
    issGraphic3dRef.current = null
  }, [])

  const handleLocate = useCallback(() => {
    if (!latestPosition) return

    const target2d = new Point({
      longitude: latestPosition.longitude,
      latitude: latestPosition.latitude,
      spatialReference: { wkid: 4326 },
    })

    jmv2dRef.current?.view
      .goTo({ target: target2d, zoom: LOCATE_ZOOM_2D })
      .catch(() => undefined)

    const target3d = new Point({
      longitude: latestPosition.longitude,
      latitude: latestPosition.latitude,
      z: latestPosition.altitude * 1000,
      spatialReference: { wkid: 4326 },
    })

    jmv3dRef.current?.view
      .goTo({ target: target3d, scale: LOCATE_DISTANCE_3D })
      .catch(() => undefined)
  }, [latestPosition])

  return (
    <div className='jimu-widget' style={styles.root}>
      {map2dWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={map2dWidgetId}
          onActiveViewChange={handle2dViewChange}
        />
      )}
      {map3dWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={map3dWidgetId}
          onActiveViewChange={handle3dViewChange}
        />
      )}

      <div style={styles.header}>
        <div>
          <div style={styles.title}>{t.title}</div>
          <div style={styles.meta}>
            {t.samples}: {sampleCount}
            {isFetching ? ` (${t.fetching})` : ''}
          </div>
        </div>

        <calcite-action-bar floating expand-disabled layout='horizontal'>
          <calcite-action
            title={t.clearHistoryTooltip}
            text={t.clear}
            icon='x'
            onClick={handleClear}
          />
          <calcite-action
            title={t.locateTooltip}
            text={t.locate}
            icon='gps-on'
            disabled={!latestPosition || undefined}
            onClick={handleLocate}
          />
        </calcite-action-bar>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {latestPosition && (
        <div style={styles.coords}>
          <div style={styles.meta}>{t.lastPosition}</div>
          <div style={styles.mono}>
            {t.lat}: {latestPosition.latitude.toFixed(5)} · {t.lon}:{' '}
            {latestPosition.longitude.toFixed(5)} · {t.alt}:{' '}
            {latestPosition.altitude.toFixed(1)} km
          </div>
        </div>
      )}

      {!map2dWidgetId && !map3dWidgetId && <div style={styles.hint}>{t.selectMapHint}</div>}
    </div>
  )
}
