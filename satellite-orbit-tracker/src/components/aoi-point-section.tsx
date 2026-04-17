import type Point from 'esri/geometry/Point'

import '@esri/calcite-components/components/calcite-button'
import '@esri/calcite-components/components/calcite-label'
import '@esri/calcite-components/components/calcite-notice'

import t from '../runtime/translations/default'

interface AoiPointSectionProps {
  point: Point | null
  placing: boolean
  layersReady: boolean
  disabled: boolean
  onStartPlacing: () => void
  onClearPoint: () => void
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
  pointInfo: { display: 'flex', alignItems: 'center', gap: 8 },
  coords: {
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  hint: { fontSize: 12, opacity: 0.6 },
} as const

/**
 * Header section that lets the user either drop a new AOI point on the
 * map or inspect and clear the current one.
 */
export default function AoiPointSection({
  point,
  placing,
  layersReady,
  disabled,
  onStartPlacing,
  onClearPoint,
}: AoiPointSectionProps): React.ReactElement {
  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <calcite-label style={styles.label}>{t.aoiPointLabel}</calcite-label>
        {point ? (
          <div style={styles.pointInfo}>
            <span style={styles.coords}>
              {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
            </span>
            <calcite-button
              appearance='transparent'
              kind='danger'
              icon-start='trash'
              label={t.clearPoint}
              disabled={disabled || undefined}
              onClick={onClearPoint}
            />
          </div>
        ) : (
          <calcite-button
            appearance='solid'
            kind='brand'
            icon-start='pin-plus'
            loading={placing || undefined}
            disabled={!layersReady || disabled || undefined}
            onClick={onStartPlacing}
          >
            {placing ? t.placing : t.place}
          </calcite-button>
        )}
      </div>

      {placing && (
        <calcite-notice open kind='info' width='full'>
          <span slot='message'>{t.placingPoint}</span>
        </calcite-notice>
      )}

      {!layersReady && !placing && <span style={styles.hint}>{t.initializingLayers}</span>}
    </div>
  )
}
