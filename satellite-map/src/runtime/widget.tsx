/** @jsx jsx */
import { jsx, type AllWidgetProps } from 'jimu-core'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { type JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'

import '@esri/calcite-components/components/calcite-notice'
import '@esri/calcite-components/components/calcite-loader'

import {
  getSatelliteKey,
  publishSelection,
  type TleSatellite,
} from 'widgets/shared-code/satellite-core'

import type { IMConfig } from '../config'
import { fetchSatellitesTle } from '../services/tle-service'
import useSatGraphicLayer from '../hooks/use-sat-graphic-layer'
import SatelliteSidebar from '../components/satellite-sidebar'
import t from './translations/default'

/**
 * Interval at which satellite positions are refreshed on the map. Tracks
 * are not refreshed on this cadence to avoid useless recomputation.
 */
const POSITION_REFRESH_INTERVAL_MS = 10_000

const styles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    flex: 1,
  },
  loadingLabel: { fontSize: 12, opacity: 0.7 },
  noticeWrapper: { padding: 12 },
} as const

/**
 * Satellite Map widget: downloads a TLE catalog, exposes a filterable
 * list for selection, and renders both current positions and 90-minute
 * orbital tracks for the current selection on an Experience Builder map.
 *
 * The selection is optionally published on a user-defined channel so the
 * Orbit Tracker widget can reuse it without forcing a global singleton.
 */
export default function Widget(props: AllWidgetProps<IMConfig>): React.ReactElement {
  const { config, useMapWidgetIds } = props
  const mapWidgetId = useMapWidgetIds?.[0]
  const channelId = config?.channelId

  const [jimuMapView, setJimuMapView] = useState<JimuMapView | null>(null)
  const [allSatellites, setAllSatellites] = useState<TleSatellite[]>([])
  const [selectedSatellites, setSelectedSatellites] = useState<TleSatellite[]>([])
  const [activeSatelliteKey, setActiveSatelliteKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  /**
   * Keep a ref mirror of the selection keys so toggle handlers can
   * decide based on a fresh value without recreating callbacks on
   * every selection change.
   */
  const selectedKeySetRef = useRef(new Set<string>())
  useEffect(() => {
    selectedKeySetRef.current = new Set(selectedSatellites.map(getSatelliteKey))
  }, [selectedSatellites])

  useEffect(() => {
    publishSelection(channelId, selectedSatellites)
  }, [selectedSatellites, channelId])

  useEffect(() => {
    const fetchUrl = config?.fetchUrl
    if (!fetchUrl) return

    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const satellites = await fetchSatellitesTle(fetchUrl, controller.signal)
        if (!cancelled) setAllSatellites(satellites)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : t.fetchUrlGenericError)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [config?.fetchUrl])

  useEffect(() => {
    if (selectedSatellites.length === 0) return
    const id = window.setInterval(
      () => setTick((n) => n + 1),
      POSITION_REFRESH_INTERVAL_MS,
    )
    return () => window.clearInterval(id)
  }, [selectedSatellites.length])

  useSatGraphicLayer({
    jimuMapView,
    selectedSatellites,
    activeSatelliteKey,
    tick,
  })

  const handleActiveViewChange = useCallback((jmv: JimuMapView) => {
    if (!jmv) return
    jmv.whenJimuMapViewLoaded().then(() => setJimuMapView(jmv))
  }, [])

  const handleToggleSatellite = useCallback((sat: TleSatellite) => {
    const key = getSatelliteKey(sat)
    if (selectedKeySetRef.current.has(key)) {
      setSelectedSatellites((prev) => prev.filter((s) => getSatelliteKey(s) !== key))
      return
    }
    setActiveSatelliteKey(key)
    setSelectedSatellites((prev) => [...prev, sat])
  }, [])

  const handleSelectAll = useCallback((satellites: TleSatellite[]) => {
    setSelectedSatellites(satellites)
  }, [])

  const handleClearAll = useCallback(() => {
    setSelectedSatellites([])
    setActiveSatelliteKey(null)
  }, [])

  const handleCenterSatellite = useCallback((sat: TleSatellite) => {
    const key = getSatelliteKey(sat)
    setActiveSatelliteKey(key)
    if (!selectedKeySetRef.current.has(key)) {
      setSelectedSatellites((prev) => [...prev, sat])
    }
  }, [])

  const errorMessage = useMemo(() => {
    if (!error) return null
    return t.fetchUrlError.replace('{status}', error)
  }, [error])

  return (
    <div className='jimu-widget' style={styles.root}>
      {mapWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={mapWidgetId}
          onActiveViewChange={handleActiveViewChange}
        />
      )}

      {loading && (
        <div style={styles.loading}>
          <calcite-loader scale='s' label={t.loadingSatellites} />
          <span style={styles.loadingLabel}>{t.loadingSatellites}</span>
        </div>
      )}

      {errorMessage && (
        <div style={styles.noticeWrapper}>
          <calcite-notice open kind='danger' scale='s' width='full' icon='exclamation-mark-triangle'>
            <span slot='message'>{errorMessage}</span>
          </calcite-notice>
        </div>
      )}

      {!loading && !errorMessage && allSatellites.length > 0 && (
        <SatelliteSidebar
          allSatellites={allSatellites}
          selectedSatellites={selectedSatellites}
          onToggleSatellite={handleToggleSatellite}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
          onCenterSatellite={handleCenterSatellite}
        />
      )}

      {!loading && !errorMessage && allSatellites.length === 0 && !config?.fetchUrl && (
        <div style={styles.noticeWrapper}>
          <calcite-notice open kind='info' scale='s' width='full' icon='information'>
            <span slot='message'>{t.noSatellitesConfigured}</span>
          </calcite-notice>
        </div>
      )}

      {!mapWidgetId && (
        <div style={styles.noticeWrapper}>
          <calcite-notice open kind='warning' scale='s' width='full' icon='exclamation-mark-triangle'>
            <span slot='message'>{t.noMapSelected}</span>
          </calcite-notice>
        </div>
      )}
    </div>
  )
}
