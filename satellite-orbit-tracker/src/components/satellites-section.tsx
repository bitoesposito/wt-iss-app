import '@esri/calcite-components/components/calcite-label'
import '@esri/calcite-components/components/calcite-notice'

import type { TleSatellite } from 'widgets/shared-code/satellite-core'
import t from '../runtime/translations/default'

interface SatellitesSectionProps {
  satellites: TleSatellite[]
  channelConfigured: boolean
}

const styles = {
  root: { padding: '8px 12px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { marginBottom: 0 },
  count: { fontSize: 12, opacity: 0.6 },
  badges: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    maxHeight: 80,
    overflowY: 'auto' as const,
  },
  badge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--calcite-color-foreground-2, rgba(0,0,0,0.06))',
    opacity: 0.9,
  },
} as const

/**
 * Section showing the satellites received from the upstream channel.
 * Renders a compact badge list and contextual notices when the channel
 * is not configured yet or the selection is empty.
 */
export default function SatellitesSection({
  satellites,
  channelConfigured,
}: SatellitesSectionProps): React.ReactElement {
  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <calcite-label style={styles.label}>{t.satellitesLabel}</calcite-label>
        <span style={styles.count}>
          {satellites.length} {t.selectedSuffix}
        </span>
      </div>

      {!channelConfigured && (
        <calcite-notice open kind='warning' width='full'>
          <span slot='message'>{t.noSourceWidget}</span>
        </calcite-notice>
      )}

      {channelConfigured && satellites.length === 0 && (
        <calcite-notice open kind='info' width='full'>
          <span slot='message'>{t.noSatellitesSelected}</span>
        </calcite-notice>
      )}

      {satellites.length > 0 && (
        <div style={styles.badges}>
          {satellites.map((sat) => (
            <span key={sat.noradId ?? sat.name} style={styles.badge}>
              {sat.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
