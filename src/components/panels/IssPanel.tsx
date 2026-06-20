import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from '../../store'
import { toggleFollow } from '../../store/iss-slice'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md bg-white/5 px-3 py-2'>
      <div className='text-[10px] uppercase tracking-wide opacity-60'>{label}</div>
      <div className='text-sm font-semibold tabular-nums'>{value}</div>
    </div>
  )
}

const formatPeriod = (minutes: number) => {
  const m = Math.floor(minutes)
  const s = Math.round((minutes - m) * 60)
  return `${m}m ${String(s).padStart(2, '0')}s`
}

const signed = (value: number, digits: number, suffix = '') =>
  `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${suffix}`

export default function IssPanel({ onCollapse }: { onCollapse: () => void }) {
  const dispatch = useDispatch<AppDispatch>()
  const positions = useSelector((s: RootState) => s.iss.positions)
  const follow = useSelector((s: RootState) => s.iss.follow)
  const orbital = useSelector((s: RootState) => s.iss.orbital)

  const latest = positions[0]

  return (
    <calcite-panel
      heading='Stazione Spaziale ISS'
      description='Posizione e parametri in tempo reale'
    >
      <calcite-action
        slot='header-actions-end'
        icon='chevron-left'
        text='Comprimi pannello'
        onClick={onCollapse}
      ></calcite-action>

      {/* Telemetria live + controlli: fissi in alto, non scrollano. */}
      <div slot='content-top' className='w-full'>
        {!latest ? (
          <div className='flex flex-col items-center justify-center gap-3 p-6'>
            <calcite-loader label='Recupero posizione ISS' />
            <p className='text-sm opacity-70'>Recupero posizione ISS…</p>
          </div>
        ) : (
          <>
            <section className='grid grid-cols-2 gap-2'>
              <Stat label='Latitudine' value={`${latest.latitude.toFixed(4)}°`} />
              <Stat
                label='Longitudine'
                value={`${latest.longitude.toFixed(4)}°`}
              />
              <Stat
                label='Altitudine'
                value={latest.altitude != null ? `${latest.altitude.toFixed(0)} km` : '—'}
              />
              <Stat
                label='Velocità'
                value={
                  latest.velocity != null
                    ? `${Math.round(latest.velocity).toLocaleString()} km/h`
                    : '—'
                }
              />
            </section>

            <div className='flex items-center justify-between gap-2 py-2 text-xs opacity-70'>
              <span>{new Date(latest.timestamp * 1000).toLocaleTimeString()}</span>
              <span className='flex items-center gap-1'>
                <span className='inline-block h-2 w-2 rounded-full bg-green-500'></span>
                Live
              </span>
            </div>

            <calcite-label layout='inline-space-between'>
              Segui automaticamente
              <calcite-switch
                checked={follow}
                oncalciteSwitchChange={() => dispatch(toggleFollow())}
              ></calcite-switch>
            </calcite-label>
          </>
        )}
      </div>

      {/* Parametri orbitali: contenuto scrollabile del pannello. */}
      <div className='p-3'>
        <div className='mb-2 flex items-center justify-between'>
          <p className='text-[11px] font-semibold uppercase tracking-wide opacity-60'>
            📐 Parametri orbitali
          </p>
          {orbital?.isInSunlight != null ? (
            <calcite-chip
              scale='s'
              kind={orbital.isInSunlight ? 'brand' : 'neutral'}
              label='Esposizione solare'
            >
              {orbital.isInSunlight ? 'In luce' : 'In ombra'}
            </calcite-chip>
          ) : null}
        </div>

        {!orbital ? (
          <p className='text-sm opacity-60'>In attesa dei dati orbitali…</p>
        ) : (
          <div className='grid grid-cols-2 gap-2'>
            <Stat label='Apoapsis' value={`${orbital.apoapsis.toFixed(1)} km`} />
            <Stat label='Periapsis' value={`${orbital.periapsis.toFixed(1)} km`} />
            <Stat
              label='Inclinazione'
              value={`${orbital.inclination.toFixed(2)}°`}
            />
            <Stat
              label='Eccentricità'
              value={orbital.eccentricity.toFixed(6)}
            />
            <Stat label='Periodo' value={formatPeriod(orbital.period)} />
            <Stat label='Rivoluzione' value={`#${orbital.revolutionNumber}`} />
            <Stat label='Beta angle' value={signed(orbital.betaAngle, 2, '°')} />
            <Stat
              label='Velocità orbitale'
              value={
                orbital.speedKmH != null
                  ? `${Math.round(orbital.speedKmH).toLocaleString()} km/h`
                  : '—'
              }
            />
          </div>
        )}
      </div>
    </calcite-panel>
  )
}
