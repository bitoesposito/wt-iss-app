import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from '../../store'
import {
  clearSelectedSatellites,
  setActiveSatelliteKey,
  setSelectedSatellites,
} from '../../store/satellite-slice'
import { fetchSatellites } from '../../lib/satellite-position-tracker'
import { getSatelliteKey } from '../../lib/satellite/satellite-utils'
import type { TleSatellite } from '../../types'

export default function SatellitePanel({
  onCollapse,
}: {
  onCollapse: () => void
}) {
  const dispatch = useDispatch<AppDispatch>()
  const positions = useSelector((s: RootState) => s.satellites.positions)
  const selected = useSelector((s: RootState) => s.satellites.selected)
  const status = useSelector((s: RootState) => s.satellites.status)
  const error = useSelector((s: RootState) => s.satellites.error)

  const [query, setQuery] = useState('')

  const selectedKeySet = useMemo(
    () => new Set(selected.map(getSatelliteKey)),
    [selected],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return positions
    return positions.filter((sat) => sat.name.toLowerCase().includes(q))
  }, [query, positions])

  const isFiltering = query.trim().length > 0

  const handleToggle = (sat: TleSatellite) => {
    const key = getSatelliteKey(sat)
    if (selectedKeySet.has(key)) {
      dispatch(
        setSelectedSatellites(selected.filter((s) => getSatelliteKey(s) !== key)),
      )
      return
    }
    dispatch(setActiveSatelliteKey(key))
    dispatch(setSelectedSatellites([...selected, sat]))
  }

  const handleSelectAll = () => {
    const target = isFiltering ? filtered : positions
    const byKey = new Map(selected.map((sat) => [getSatelliteKey(sat), sat]))
    for (const sat of target) byKey.set(getSatelliteKey(sat), sat)
    dispatch(setSelectedSatellites([...byKey.values()]))
  }

  const handleClear = () => dispatch(clearSelectedSatellites())

  const headerCollapse = (
    <calcite-action
      slot='header-actions-end'
      icon='chevron-left'
      text='Comprimi pannello'
      onClick={onCollapse}
    ></calcite-action>
  )

  // --- Stati ----------------------------------------------------------------

  if (status === 'loading' || status === 'idle') {
    return (
      <calcite-panel heading='Satelliti' description='Traiettorie orbitali'>
        {headerCollapse}
        <div className='flex flex-col items-center justify-center gap-3 p-8'>
          <calcite-loader label='Caricamento satelliti' />
          <p className='text-sm opacity-70'>Caricamento satelliti…</p>
        </div>
      </calcite-panel>
    )
  }

  if (status === 'error') {
    return (
      <calcite-panel heading='Satelliti' description='Traiettorie orbitali'>
        {headerCollapse}
        <div className='p-3'>
          <calcite-notice open kind='danger' icon scale='s'>
            <div slot='title'>Errore di caricamento</div>
            <div slot='message'>
              {error ?? 'Impossibile caricare i satelliti.'}
            </div>
          </calcite-notice>
          <calcite-button
            className='mt-3'
            width='full'
            appearance='outline'
            kind='neutral'
            icon-start='refresh'
            onClick={() => dispatch(fetchSatellites())}
          >
            Riprova
          </calcite-button>
        </div>
      </calcite-panel>
    )
  }

  // --- Lista (controlli fissi in content-top, lista scrollabile) ------------

  return (
    <calcite-panel heading='Satelliti' description='Traiettorie orbitali'>
      {headerCollapse}

      <div slot='content-top' className='w-full'>
        <div className='flex items-center justify-between gap-2 pt-2'>
          <calcite-chip scale='s' kind='brand' label='Selezionati'>
            {selected.length} selezionati
          </calcite-chip>
          <span className='text-xs opacity-60'>
            {positions.length} disponibili
          </span>
        </div>

        <p className='pb-2 pt-1 text-[11px] opacity-70'>
          Seleziona i satelliti per visualizzarne le traiettorie sul globo.
        </p>

        <calcite-input-text
          placeholder='Filtra satelliti'
          value={query}
          clearable
          oncalciteInputTextInput={(event: CustomEvent) => {
            const value = (event.target as unknown as { value?: string }).value
            setQuery(value ?? '')
          }}
        ></calcite-input-text>

        <div className='flex gap-1 pt-2'>
          <calcite-button
            className='flex-1'
            appearance='outline'
            kind='neutral'
            scale='s'
            icon-start='check-circle'
            onClick={handleSelectAll}
          >
            {isFiltering ? `Seleziona ${filtered.length}` : 'Seleziona tutti'}
          </calcite-button>
          <calcite-button
            className='flex-1'
            appearance='outline'
            kind='neutral'
            scale='s'
            icon-start='trash'
            disabled={selected.length === 0}
            onClick={handleClear}
          >
            Pulisci
          </calcite-button>
        </div>

        {isFiltering ? (
          <p className='px-3 pt-1 text-xs opacity-70'>
            {filtered.length} risultati
          </p>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className='px-3 py-3 text-sm opacity-60'>Nessun risultato.</p>
      ) : (
        filtered.map((sat) => {
          const key = getSatelliteKey(sat)
          const isSelected = selectedKeySet.has(key)
          return (
            <div
              key={key}
              className='flex items-center gap-1 px-3 hover:bg-white/5'
            >
              <calcite-label
                className='flex-1 cursor-pointer select-none'
                layout='inline'
              >
                <calcite-checkbox
                  checked={isSelected}
                  oncalciteCheckboxChange={() => handleToggle(sat)}
                ></calcite-checkbox>
                <span
                  className='overflow-hidden text-ellipsis whitespace-nowrap text-sm'
                  title={sat.name}
                >
                  {sat.name}
                </span>
              </calcite-label>
            </div>
          )
        })
      )}
    </calcite-panel>
  )
}
