import { createPortal } from 'react-dom'

import '@esri/calcite-components/components/calcite-dialog'
import '@esri/calcite-components/components/calcite-list'
import '@esri/calcite-components/components/calcite-list-item'
import '@esri/calcite-components/components/calcite-icon'
import '@esri/calcite-components/components/calcite-notice'

import type { SatellitePass } from 'widgets/shared-code/satellite-core'
import { formatDuration } from '../lib/date-utils'
import t from '../runtime/translations/default'

interface ResultsDialogProps {
  open: boolean
  results: SatellitePass[]
  onClose: () => void
}

const styles = {
  emptyWrapper: { padding: 12 },
  list: { maxHeight: '60vh', overflowY: 'auto' as const },
  duration: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
} as const

/**
 * Modal dialog rendered in a portal so Calcite overlay positioning is
 * not affected by the widget container overflow. Lists every computed
 * pass with its duration badge.
 */
export default function ResultsDialog({
  open,
  results,
  onClose,
}: ResultsDialogProps): React.ReactElement {
  return createPortal(
    <calcite-dialog
      heading={`${t.dialogHeading} (${results.length})`}
      open={open || undefined}
      modal
      oncalciteDialogClose={onClose}
    >
      {results.length === 0 ? (
        <div style={styles.emptyWrapper}>
          <calcite-notice open kind='info' width='full'>
            <span slot='message'>{t.noResults}</span>
          </calcite-notice>
        </div>
      ) : (
        <calcite-list label={t.dialogHeading} style={styles.list}>
          {results.map((pass, idx) => (
            <calcite-list-item
              key={`${pass.satName}-${pass.startTimestamp}-${idx}`}
              label={pass.satName}
              description={`${new Date(pass.startTimestamp).toLocaleString()} \u2192 ${new Date(pass.endTimestamp).toLocaleString()}`}
            >
              <calcite-icon slot='content-start' icon='globe' />
              <span slot='content-end' style={styles.duration}>
                {formatDuration(pass.startTimestamp, pass.endTimestamp)}
              </span>
            </calcite-list-item>
          ))}
        </calcite-list>
      )}
    </calcite-dialog>,
    document.body,
  )
}
