/** @jsx jsx */
import { jsx, type AllWidgetProps } from 'jimu-core'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { type JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'

import '@esri/calcite-components/components/calcite-button'
import '@esri/calcite-components/components/calcite-input-number'
import '@esri/calcite-components/components/calcite-label'
import '@esri/calcite-components/components/calcite-notice'

import {
  readCalciteNumberValue,
  subscribeSelection,
  type SatellitePass,
  type TleSatellite,
} from 'widgets/shared-code/satellite-core'

import type { IMConfig } from '../config'
import { calculateSatellitePasses } from '../lib/calculate-satellite-passes'
import { combineDateAndTime, toIsoDate, toIsoTime } from '../lib/date-utils'
import useAoiPoint from '../hooks/use-aoi-point'
import AoiPointSection from '../components/aoi-point-section'
import TimeRangeSection from '../components/time-range-section'
import SatellitesSection from '../components/satellites-section'
import ResultsDialog from '../components/results-dialog'
import t from './translations/default'

const DEFAULT_BUFFER_KM = 100
const MIN_BUFFER_KM = 10
const MAX_RANGE_MS = 6 * 24 * 60 * 60 * 1000
const CALCULATION_STEP_MS = 60_000

const styles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  noticeWrapper: { padding: 12 },
  scrollArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
    overflowY: 'auto' as const,
  },
  header: { padding: '8px 12px 4px' },
  headerLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  separator: {
    margin: '0 12px',
    border: 0,
    borderTop: '1px solid var(--calcite-color-border-3, rgba(0,0,0,0.08))',
  },
  bufferSection: { padding: '8px 12px' },
  actionsSection: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  errorWrapper: { padding: '0 12px 8px' },
} as const

/**
 * Satellite Orbit Tracker widget: given a point + radius on a map, a
 * time window, and a set of satellites inherited from the Satellite Map
 * widget, computes every satellite pass whose ground track intersects
 * the area of interest and presents them as a dialog.
 *
 * Heavy work is delegated to {@link calculateSatellitePasses}, which
 * yields to the event loop at regular intervals so the widget never
 * locks the browser while crunching multi-day ranges.
 */
export default function Widget(props: AllWidgetProps<IMConfig>): React.ReactElement {
  const { config, useMapWidgetIds } = props
  const mapWidgetId = useMapWidgetIds?.[0]
  const channelId = config?.channelId

  const [jimuMapView, setJimuMapView] = useState<JimuMapView | null>(null)
  const [selectedSatellites, setSelectedSatellites] = useState<TleSatellite[]>([])
  const [bufferKm, setBufferKm] = useState(DEFAULT_BUFFER_KM)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SatellitePass[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!channelId) return
    return subscribeSelection(channelId, setSelectedSatellites)
  }, [channelId])

  const handleActiveViewChange = useCallback((jmv: JimuMapView) => {
    if (!jmv) return
    jmv.whenJimuMapViewLoaded().then(() => setJimuMapView(jmv))
  }, [])

  const { point, placing, layersReady, startPlacing, clearPoint } = useAoiPoint({
    jimuMapView,
    bufferKm,
  })

  const validation = useMemo(() => {
    const hasPoint = Boolean(point)
    const isBufferValid = Number.isFinite(bufferKm) && bufferKm >= MIN_BUFFER_KM
    const hasSatellites = selectedSatellites.length > 0

    const start = startDate && startTime ? combineDateAndTime(startDate, startTime) : null
    const end = endDate && endTime ? combineDateAndTime(endDate, endTime) : null

    const isRangeValid = Boolean(
      start &&
        end &&
        end.getTime() > start.getTime() &&
        end.getTime() - start.getTime() <= MAX_RANGE_MS,
    )

    return {
      hasPoint,
      isBufferValid,
      hasSatellites,
      isRangeValid,
      start,
      end,
      canRun: hasPoint && isBufferValid && hasSatellites && isRangeValid && !isRunning,
    }
  }, [point, bufferKm, selectedSatellites, startDate, endDate, startTime, endTime, isRunning])

  const handleSetQuickRange = useCallback(() => {
    const now = new Date()
    const later = new Date(now.getTime() + 60 * 60 * 1000)
    setStartDate(toIsoDate(now))
    setStartTime(toIsoTime(now))
    setEndDate(toIsoDate(later))
    setEndTime(toIsoTime(later))
  }, [])

  const handleRun = useCallback(async () => {
    if (!validation.canRun) return
    const { start, end } = validation
    if (!start || !end || !point) return

    setError(null)
    setIsRunning(true)

    const controller = new AbortController()
    try {
      const passes = await calculateSatellitePasses({
        satellites: selectedSatellites,
        start,
        end,
        stepMs: CALCULATION_STEP_MS,
        aoi: point,
        aoiBufferKm: bufferKm,
        signal: controller.signal,
      })
      setResults(passes)
      if (passes.length > 0) setDialogOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.calculationError)
    } finally {
      setIsRunning(false)
    }
  }, [validation, point, selectedSatellites, bufferKm])

  useEffect(() => {
    setResults([])
    setError(null)
  }, [point, bufferKm, selectedSatellites])

  const handleBufferChange = useCallback((event: CustomEvent) => {
    const value = readCalciteNumberValue(event)
    if (value !== null) setBufferKm(value)
  }, [])

  return (
    <div className='jimu-widget' style={styles.root}>
      {mapWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={mapWidgetId}
          onActiveViewChange={handleActiveViewChange}
        />
      )}

      {!mapWidgetId && (
        <div style={styles.noticeWrapper}>
          <calcite-notice open kind='warning' width='full'>
            <span slot='message'>{t.noMapSelected}</span>
          </calcite-notice>
        </div>
      )}

      {mapWidgetId && (
        <div style={styles.scrollArea}>
          <div style={styles.header}>
            <span style={styles.headerLabel}>{t.title}</span>
          </div>

          <AoiPointSection
            point={point}
            placing={placing}
            layersReady={layersReady}
            disabled={isRunning}
            onStartPlacing={startPlacing}
            onClearPoint={clearPoint}
          />

          <hr style={styles.separator} />

          <div style={styles.bufferSection}>
            <calcite-label>
              {t.bufferKmLabel}
              <calcite-input-number
                min={MIN_BUFFER_KM}
                step={10}
                integer
                number-button-type='horizontal'
                value={String(bufferKm)}
                disabled={isRunning || undefined}
                suffix-text='km'
                oncalciteInputNumberInput={handleBufferChange}
              />
            </calcite-label>
          </div>

          <hr style={styles.separator} />

          <TimeRangeSection
            startDate={startDate}
            startTime={startTime}
            endDate={endDate}
            endTime={endTime}
            disabled={isRunning}
            isValid={validation.isRangeValid}
            onStartDateChange={setStartDate}
            onStartTimeChange={setStartTime}
            onEndDateChange={setEndDate}
            onEndTimeChange={setEndTime}
            onQuickRange={handleSetQuickRange}
          />

          <hr style={styles.separator} />

          <SatellitesSection
            satellites={selectedSatellites}
            channelConfigured={Boolean(channelId)}
          />

          <hr style={styles.separator} />

          <div style={styles.actionsSection}>
            <calcite-button
              width='full'
              kind='brand'
              disabled={!validation.canRun || undefined}
              loading={isRunning || undefined}
              onClick={handleRun}
            >
              {isRunning ? t.calculating : t.calculatePasses}
            </calcite-button>

            {results.length > 0 && (
              <calcite-button
                width='full'
                appearance='outline'
                kind='neutral'
                onClick={() => setDialogOpen(true)}
              >
                {t.openResults} ({results.length})
              </calcite-button>
            )}
          </div>

          {error && (
            <div style={styles.errorWrapper}>
              <calcite-notice open kind='danger' width='full'>
                <span slot='message'>{error}</span>
              </calcite-notice>
            </div>
          )}
        </div>
      )}

      <ResultsDialog
        open={dialogOpen}
        results={results}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}
