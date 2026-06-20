import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from './store'
import type { ViewMode } from './types'
import { subscribeIssTelemetry } from './lib/iss-stream'
import { loadIssTle } from './lib/iss-orbit'
import { fetchSatellites } from './lib/satellite-position-tracker'
import { setViewMode } from './store/view-slice'

import MapComponent from './components/map/Map'
import IssPanel from './components/panels/IssPanel'
import SatellitePanel from './components/panels/SatellitePanel'

const MOBILE_QUERY = '(max-width: 768px)'

export function App(): React.JSX.Element {
  const dispatch = useDispatch<AppDispatch>()
  const viewMode = useSelector((s: RootState) => s.viewMode.viewMode)
  const satelliteStatus = useSelector((s: RootState) => s.satellites.status)

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_QUERY).matches,
  )
  // Su mobile il pannello parte chiuso così la mappa è subito visibile.
  const [panelOpen, setPanelOpen] = useState(
    () => !window.matchMedia(MOBILE_QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Stream SSE della posizione ISS, sospeso quando la tab non è visibile.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    const open = () => {
      if (!unsubscribe) unsubscribe = subscribeIssTelemetry(dispatch)
    }
    const close = () => {
      unsubscribe?.()
      unsubscribe = null
    }
    const handleVisibility = () => {
      if (document.hidden) close()
      else open()
    }

    if (!document.hidden) open()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      close()
    }
  }, [dispatch])

  // TLE ISS (Celestrak) per la traiettoria orbitale.
  useEffect(() => {
    dispatch(loadIssTle())
  }, [dispatch])

  // Caricamento TLE satelliti, una sola volta entrando in modalità satellite.
  useEffect(() => {
    if (viewMode !== 'satellite') return
    if (satelliteStatus !== 'idle') return
    dispatch(fetchSatellites())
  }, [dispatch, viewMode, satelliteStatus])

  // Click sulla modalità attiva → toggle pannello; altra modalità → switch + apri.
  const selectMode = (mode: ViewMode) => {
    if (mode === viewMode) {
      setPanelOpen((open) => !open)
      return
    }
    dispatch(setViewMode(mode))
    setPanelOpen(true)
  }

  return (
    <calcite-shell>
      <header
        slot='header'
        className='flex items-center gap-2 border-b border-white/10 px-3 py-2'
      >
        <img src='logo.svg' alt='Satellite Tracker' className='h-6' />
        <div className='h-6 w-px bg-white/20' />
        <img src='esri.svg' alt='Esri' className='h-5 invert' />
        <span className='ml-2 text-sm font-semibold'>Satellite Tracker</span>
      </header>

      <calcite-shell-panel
        slot='panel-start'
        display-mode={isMobile ? 'overlay' : 'dock'}
        width-scale='m'
        collapsed={!panelOpen}
      >
        <calcite-action-bar slot='action-bar'>
          <calcite-action-group>
            <calcite-action
              text='ISS'
              icon='globe'
              active={viewMode === 'iss'}
              onClick={() => selectMode('iss')}
            ></calcite-action>
            <calcite-action
              text='Satelliti'
              icon='layers'
              active={viewMode === 'satellite'}
              onClick={() => selectMode('satellite')}
            ></calcite-action>
          </calcite-action-group>
        </calcite-action-bar>

        {viewMode === 'iss' ? (
          <IssPanel onCollapse={() => setPanelOpen(false)} />
        ) : (
          <SatellitePanel onCollapse={() => setPanelOpen(false)} />
        )}
      </calcite-shell-panel>

      {/* key={viewMode}: remount intenzionale per ripartire da vista pulita
          quando si passa tra mappa ISS (2D/3D) e scene satellitare. */}
      <MapComponent key={viewMode} />
    </calcite-shell>
  )
}
