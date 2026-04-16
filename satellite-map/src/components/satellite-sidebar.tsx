import { useMemo, useState } from 'react'
import type { TleSatellite } from '../types'
import { getSatelliteKey } from '../types'
import t from '../runtime/translations/default'

import '@esri/calcite-components/components/calcite-input-text'
import '@esri/calcite-components/components/calcite-checkbox'
import '@esri/calcite-components/components/calcite-button'
import '@esri/calcite-components/components/calcite-icon'

interface SatelliteSidebarProps {
  allSatellites: TleSatellite[]
  selectedSatellites: TleSatellite[]
  onToggleSatellite: (sat: TleSatellite) => void
  onSelectAll: (satellites: TleSatellite[]) => void
  onClearAll: () => void
  onCenterSatellite: (sat: TleSatellite) => void
}

const ROW_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  borderRadius: '4px',
  marginBottom: '2px',
  cursor: 'pointer',
  transition: 'background-color 120ms ease',
  userSelect: 'none',
}

export default function SatelliteSidebar({
  allSatellites,
  selectedSatellites,
  onToggleSatellite,
  onSelectAll,
  onClearAll,
  onCenterSatellite,
}: SatelliteSidebarProps) {
  const [query, setQuery] = useState('')

  const selectedKeySet = useMemo(
    () => new Set(selectedSatellites.map(getSatelliteKey)),
    [selectedSatellites]
  )

  const filteredSatellites = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return allSatellites
    return allSatellites.filter((sat) =>
      sat.name.toLowerCase().includes(trimmed)
    )
  }, [query, allSatellites])

  const handleSelectAll = () => {
    const trimmed = query.trim()

    if (!trimmed) {
      onSelectAll(allSatellites)
      return
    }

    const byKey = new Map(
      selectedSatellites.map((sat) => [getSatelliteKey(sat), sat])
    )
    for (const sat of filteredSatellites) {
      byKey.set(getSatelliteKey(sat), sat)
    }
    onSelectAll([...byKey.values()])
  }

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 12px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {t.sidebarTitle}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'var(--calcite-color-foreground-2, #f3f3f3)',
              color: 'var(--calcite-color-text-2, #6a6a6a)',
            }}
          >
            {selectedSatellites.length}/{allSatellites.length}
          </span>
        </div>

        <calcite-input-text
          clearable
          icon='search'
          scale='s'
          label={t.filterSatellitesLabel}
          placeholder={t.filterSatellitesPlaceholder}
          value={query}
          oncalciteInputTextInput={(event: CustomEvent) => {
            const value = (event.target as unknown as { value?: string }).value
            setQuery(value ?? '')
          }}
        />

        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', marginBottom: '8px' }}>
          <calcite-button
            appearance='outline'
            kind='brand'
            scale='s'
            width='half'
            icon-start='check-circle'
            onClick={() => handleSelectAll()}
            label={t.selectAllLabel}
          >
            {t.selectAll}
          </calcite-button>
          <calcite-button
            appearance='outline'
            kind='neutral'
            scale='s'
            width='half'
            icon-start='reset'
            onClick={() => onClearAll()}
            disabled={selectedSatellites.length === 0 || undefined}
            label={t.clearLabel}
          >
            {t.clear}
          </calcite-button>
        </div>
      </div>

      <hr style={{ margin: '0 12px', border: 'none', borderTop: '1px solid var(--calcite-color-border-3, #eaeaea)' }} />

      {/* Satellite list */}
      <div
        role='listbox'
        aria-label={t.sidebarTitle}
        style={{
          flex: '1 1 0',
          overflowY: 'auto',
          padding: '8px 8px 12px',
          minHeight: 0,
        }}
      >
        {filteredSatellites.map((sat) => {
          const key = getSatelliteKey(sat)
          const isSelected = selectedKeySet.has(key)

          return (
            <div
              key={key}
              role='option'
              aria-selected={isSelected}
              style={{
                ...ROW_BASE,
                backgroundColor: isSelected
                  ? 'var(--calcite-color-foreground-2, #f3f3f3)'
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--calcite-color-foreground-2, #f8f8f8)'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = isSelected
                  ? 'var(--calcite-color-foreground-2, #f3f3f3)'
                  : 'transparent'
              }}
            >
              <calcite-checkbox
                checked={isSelected || undefined}
                scale='s'
                label={t.selectSatelliteLabel.replace('{name}', sat.name)}
                oncalciteCheckboxChange={() => onToggleSatellite(sat)}
              />
              <span
                style={{
                  flex: '1 1 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected
                    ? 'var(--calcite-color-text-1, #151515)'
                    : 'var(--calcite-color-text-2, #6a6a6a)',
                  lineHeight: 1.4,
                }}
                title={sat.name}
                role='button'
                tabIndex={0}
                aria-label={t.centerOnSatelliteAriaLabel.replace('{name}', sat.name)}
                onClick={() => onCenterSatellite(sat)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onCenterSatellite(sat)
                  }
                }}
              >
                {sat.name}
              </span>
              {isSelected && (
                <calcite-icon
                  icon='gps-on'
                  scale='s'
                  style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.5 }}
                  onClick={() => onCenterSatellite(sat)}
                />
              )}
            </div>
          )
        })}

        {filteredSatellites.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 12px',
              fontSize: '0.8rem',
              color: 'var(--calcite-color-text-3, #999)',
            }}
          >
            {t.noSatellitesFound}
          </div>
        )}
      </div>
    </div>
  )
}
