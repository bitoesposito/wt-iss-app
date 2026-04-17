import { useMemo, useState, useCallback } from 'react'

import {
  getSatelliteKey,
  readCalciteStringValue,
  type TleSatellite,
} from 'widgets/shared-code/satellite-core'
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

const styles = {
  root: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: { padding: '12px 12px 0' },
  headerTop: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  counter: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'var(--calcite-color-foreground-2, rgba(0,0,0,0.06))',
    opacity: 0.8,
  },
  buttonsRow: { display: 'flex', gap: 4, marginTop: 8, marginBottom: 8 },
  separator: {
    margin: '0 12px',
    border: 0,
    borderTop: '1px solid var(--calcite-color-border-3, rgba(0,0,0,0.08))',
  },
  list: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto' as const,
    padding: '8px 8px 12px',
  },
  row: (isSelected: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    marginBottom: 2,
    borderRadius: 4,
    cursor: 'pointer',
    userSelect: 'none' as const,
    transition: 'background-color 120ms ease',
    background: isSelected
      ? 'var(--calcite-color-foreground-2, rgba(0,0,0,0.06))'
      : 'transparent',
  }),
  rowName: (isSelected: boolean) => ({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: isSelected ? 600 : 400,
    opacity: isSelected ? 1 : 0.8,
  }),
  rowIcon: { cursor: 'pointer', flexShrink: 0, opacity: 0.6 },
  empty: {
    textAlign: 'center' as const,
    padding: '24px 12px',
    fontSize: 12,
    opacity: 0.6,
  },
} as const

/**
 * Format a "selected / total" counter. Extracted so markup stays clean
 * and the counter can be unit-tested without rendering.
 */
const formatSelectionCounter = (selected: number, total: number): string =>
  `${selected}/${total}`

interface SatelliteRowProps {
  satellite: TleSatellite
  isSelected: boolean
  onToggle: (sat: TleSatellite) => void
  onCenter: (sat: TleSatellite) => void
}

/**
 * Single selectable row. Split out from the sidebar so each row only
 * re-renders when its satellite or selection state actually change.
 */
const SatelliteRow = ({ satellite, isSelected, onToggle, onCenter }: SatelliteRowProps): React.ReactElement => {
  const handleCenter = useCallback(() => onCenter(satellite), [onCenter, satellite])
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onCenter(satellite)
      }
    },
    [onCenter, satellite],
  )

  return (
    <div role='option' aria-selected={isSelected} style={styles.row(isSelected)}>
      <calcite-checkbox
        checked={isSelected || undefined}
        scale='s'
        label={t.selectSatelliteLabel.replace('{name}', satellite.name)}
        oncalciteCheckboxChange={() => onToggle(satellite)}
      />
      <span
        style={styles.rowName(isSelected)}
        title={satellite.name}
        role='button'
        tabIndex={0}
        aria-label={t.centerOnSatelliteAriaLabel.replace('{name}', satellite.name)}
        onClick={handleCenter}
        onKeyDown={handleKeyDown}
      >
        {satellite.name}
      </span>
      {isSelected && (
        <calcite-icon
          icon='gps-on'
          scale='s'
          style={styles.rowIcon}
          onClick={handleCenter}
        />
      )}
    </div>
  )
}

/**
 * Sidebar listing the satellites available from the loaded TLE feed.
 * Supports free-text filtering, select-all scoped to the current filter,
 * individual toggling, and "center on satellite" for the active map.
 */
export default function SatelliteSidebar({
  allSatellites,
  selectedSatellites,
  onToggleSatellite,
  onSelectAll,
  onClearAll,
  onCenterSatellite,
}: SatelliteSidebarProps): React.ReactElement {
  const [query, setQuery] = useState('')

  const selectedKeySet = useMemo(
    () => new Set(selectedSatellites.map(getSatelliteKey)),
    [selectedSatellites],
  )

  const filteredSatellites = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return allSatellites
    return allSatellites.filter((sat) => sat.name.toLowerCase().includes(trimmed))
  }, [query, allSatellites])

  /**
   * Select-all follows the current filter: when the user typed a query,
   * only the visible subset is added to the selection (the rest stays
   * untouched). Without a query the whole catalog is selected.
   */
  const handleSelectAll = useCallback(() => {
    if (!query.trim()) {
      onSelectAll(allSatellites)
      return
    }
    const byKey = new Map(selectedSatellites.map((sat) => [getSatelliteKey(sat), sat]))
    for (const sat of filteredSatellites) byKey.set(getSatelliteKey(sat), sat)
    onSelectAll([...byKey.values()])
  }, [query, allSatellites, selectedSatellites, filteredSatellites, onSelectAll])

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <span style={styles.title}>{t.sidebarTitle}</span>
          <span style={styles.counter}>
            {formatSelectionCounter(selectedSatellites.length, allSatellites.length)}
          </span>
        </div>

        <calcite-input-text
          clearable
          icon='search'
          scale='s'
          label={t.filterSatellitesLabel}
          placeholder={t.filterSatellitesPlaceholder}
          value={query}
          oncalciteInputTextInput={(event: CustomEvent) => setQuery(readCalciteStringValue(event))}
        />

        <div style={styles.buttonsRow}>
          <calcite-button
            appearance='outline'
            kind='brand'
            scale='s'
            width='half'
            icon-start='check-circle'
            onClick={handleSelectAll}
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
            onClick={onClearAll}
            disabled={selectedSatellites.length === 0 || undefined}
            label={t.clearLabel}
          >
            {t.clear}
          </calcite-button>
        </div>
      </div>

      <hr style={styles.separator} />

      <div role='listbox' aria-label={t.sidebarTitle} style={styles.list}>
        {filteredSatellites.map((sat) => {
          const key = getSatelliteKey(sat)
          return (
            <SatelliteRow
              key={key}
              satellite={sat}
              isSelected={selectedKeySet.has(key)}
              onToggle={onToggleSatellite}
              onCenter={onCenterSatellite}
            />
          )
        })}

        {filteredSatellites.length === 0 && <div style={styles.empty}>{t.noSatellitesFound}</div>}
      </div>
    </div>
  )
}
