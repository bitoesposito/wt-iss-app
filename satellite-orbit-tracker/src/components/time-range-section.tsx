import '@esri/calcite-components/components/calcite-button'
import '@esri/calcite-components/components/calcite-label'
import '@esri/calcite-components/components/calcite-input-date-picker'
import '@esri/calcite-components/components/calcite-input-time-picker'
import '@esri/calcite-components/components/calcite-notice'

import { readCalciteStringValue } from 'widgets/shared-code/satellite-core'

import t from '../runtime/translations/default'

interface TimeRangeSectionProps {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  disabled: boolean
  isValid: boolean
  onStartDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onQuickRange: () => void
}

const styles = {
  root: { padding: '8px 12px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLabel: { marginBottom: 0 },
  row: { display: 'flex', gap: 8, marginBottom: 8 },
  rowLast: { display: 'flex', gap: 8 },
  cell: { flex: 1 },
  notice: { marginTop: 8 },
} as const

/**
 * Form section collecting the evaluation window as two date+time pairs,
 * with a shortcut button for "now → +1h" and inline validation output.
 */
export default function TimeRangeSection({
  startDate,
  startTime,
  endDate,
  endTime,
  disabled,
  isValid,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onQuickRange,
}: TimeRangeSectionProps): React.ReactElement {
  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <calcite-label style={styles.headerLabel}>{t.timeRangeLabel}</calcite-label>
        <calcite-button
          appearance='outline'
          kind='neutral'
          icon-start='clock-forward'
          disabled={disabled || undefined}
          onClick={onQuickRange}
        >
          {t.oneHourFromNow}
        </calcite-button>
      </div>

      <div style={styles.row}>
        <calcite-label style={styles.cell}>
          {t.startDateLabel}
          <calcite-input-date-picker
            value={startDate}
            disabled={disabled || undefined}
            overlay-positioning='fixed'
            oncalciteInputDatePickerChange={(e: CustomEvent) =>
              onStartDateChange(readCalciteStringValue(e))
            }
          />
        </calcite-label>
        <calcite-label style={styles.cell}>
          {t.startTimeLabel}
          <calcite-input-time-picker
            value={startTime}
            disabled={disabled || undefined}
            hour-format='24'
            step={60}
            oncalciteInputTimePickerChange={(e: CustomEvent) =>
              onStartTimeChange(readCalciteStringValue(e))
            }
          />
        </calcite-label>
      </div>

      <div style={styles.rowLast}>
        <calcite-label style={styles.cell}>
          {t.endDateLabel}
          <calcite-input-date-picker
            value={endDate}
            disabled={disabled || undefined}
            overlay-positioning='fixed'
            oncalciteInputDatePickerChange={(e: CustomEvent) =>
              onEndDateChange(readCalciteStringValue(e))
            }
          />
        </calcite-label>
        <calcite-label style={styles.cell}>
          {t.endTimeLabel}
          <calcite-input-time-picker
            value={endTime}
            disabled={disabled || undefined}
            hour-format='24'
            step={60}
            oncalciteInputTimePickerChange={(e: CustomEvent) =>
              onEndTimeChange(readCalciteStringValue(e))
            }
          />
        </calcite-label>
      </div>

      {!isValid && (startDate || endDate) && (
        <calcite-notice open kind='danger' width='full' style={styles.notice}>
          <span slot='message'>{t.invalidRange}</span>
        </calcite-notice>
      )}
    </div>
  )
}
