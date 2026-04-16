/** @jsx jsx */
import { jsx, type AllWidgetProps } from 'jimu-core'
import { useState, useEffect, useCallback, useRef } from 'react'
import { type JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'

import '@esri/calcite-components/components/calcite-notice'
import '@esri/calcite-components/components/calcite-loader'

import type { IMConfig } from '../config'
import type { TleSatellite } from '../types'
import { getSatelliteKey } from '../types'
import { fetchSatellitesTle } from '../services/tle-service'
import useSatGraphicLayer from '../hooks/use-sat-graphic-layer'
import SatelliteSidebar from '../components/satellite-sidebar'
import t from './translations/default'

const REFRESH_INTERVAL_MS = 10_000

export default function Widget(props: AllWidgetProps<IMConfig>) {
  const { config, useMapWidgetIds } = props
  const mapWidgetId = useMapWidgetIds?.[0]

  const [jimuMapView, setJimuMapView] = useState<JimuMapView | null>(null)
  const [allSatellites, setAllSatellites] = useState<TleSatellite[]>([])
  const [selectedSatellites, setSelectedSatellites] = useState<TleSatellite[]>([])
  const [activeSatelliteKey, setActiveSatelliteKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const selectedKeySetRef = useRef(new Set<string>())

  useEffect(() => {
    selectedKeySetRef.current = new Set(selectedSatellites.map(getSatelliteKey))

    const channelId = config?.channelId
    if (!channelId) return

    const channelKey = `__sat_channel_${channelId}`
    ;(window as any)[channelKey] = selectedSatellites
    window.dispatchEvent(
      new CustomEvent('satellite-selection-changed', {
        detail: { channelId, satellites: selectedSatellites },
      })
    )
  }, [selectedSatellites, config?.channelId])

  useEffect(() => {
    const fetchUrl = config?.fetchUrl
    if (!fetchUrl) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const satellites = await fetchSatellitesTle(fetchUrl)
        if (!cancelled) setAllSatellites(satellites)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fetch failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [config?.fetchUrl])

  useEffect(() => {
    if (selectedSatellites.length === 0) return

    const id = window.setInterval(() => setTick((t) => t + 1), REFRESH_INTERVAL_MS)
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

  const handleToggleSatellite = useCallback(
    (sat: TleSatellite) => {
      const key = getSatelliteKey(sat)
      const isSelected = selectedKeySetRef.current.has(key)

      if (isSelected) {
        setSelectedSatellites((prev) =>
          prev.filter((s) => getSatelliteKey(s) !== key)
        )
        return
      }

      setActiveSatelliteKey(key)
      setSelectedSatellites((prev) => [...prev, sat])
    },
    []
  )

  const handleSelectAll = useCallback((satellites: TleSatellite[]) => {
    setSelectedSatellites(satellites)
  }, [])

  const handleClearAll = useCallback(() => {
    setSelectedSatellites([])
    setActiveSatelliteKey(null)
  }, [])

  const handleCenterSatellite = useCallback(
    (sat: TleSatellite) => {
      const key = getSatelliteKey(sat)
      setActiveSatelliteKey(key)

      if (!selectedKeySetRef.current.has(key)) {
        setSelectedSatellites((prev) => [...prev, sat])
      }
    },
    []
  )

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {mapWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={mapWidgetId}
          onActiveViewChange={handleActiveViewChange}
        />
      )}

      {loading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '32px 16px',
            flex: 1,
          }}
        >
          <calcite-loader scale='s' label={t.loadingSatellites} />
          <span style={{ fontSize: '0.8rem', color: 'var(--calcite-color-text-3, #999)' }}>
            {t.loadingSatellites}
          </span>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px' }}>
          <calcite-notice open kind='danger' scale='s' width='full' icon='exclamation-mark-triangle'>
            <span slot='message'>
              {t.fetchUrlError.replace('{status}', error.toString())}
            </span>
          </calcite-notice>
        </div>
      )}

      {!loading && !error && allSatellites.length > 0 && (
        <SatelliteSidebar
          allSatellites={allSatellites}
          selectedSatellites={selectedSatellites}
          onToggleSatellite={handleToggleSatellite}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
          onCenterSatellite={handleCenterSatellite}
        />
      )}

      {!loading && !error && allSatellites.length === 0 && !config?.fetchUrl && (
        <div style={{ padding: '12px' }}>
          <calcite-notice open kind='info' scale='s' width='full' icon='information'>
            <span slot='message'>{t.noSatellitesConfigured}</span>
          </calcite-notice>
        </div>
      )}

      {!mapWidgetId && (
        <div style={{ padding: '12px' }}>
          <calcite-notice open kind='warning' scale='s' width='full' icon='exclamation-mark-triangle'>
            <span slot='message'>{t.noMapSelected}</span>
          </calcite-notice>
        </div>
      )}
    </div>
  )
}
