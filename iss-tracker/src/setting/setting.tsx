import { Immutable } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import {
  MapWidgetSelector,
  SettingSection,
  SettingRow,
} from 'jimu-ui/advanced/setting-components'
import { TextInput, NumericInput } from 'jimu-ui'

import type { IMConfig } from '../config'
import defaultI18nMessages from './translations/default'

/**
 * Settings panel for the ISS Tracker widget. Exposes the fetch endpoint,
 * polling interval, position history cap, and the two map/scene widget
 * slots the runtime view uses to render 2D and 3D positions.
 */
export default function Setting(props: AllWidgetSettingProps<IMConfig>): React.ReactElement {
  const handleFetchUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('fetchUrl', event.target.value),
    })
  }

  const handleRefreshIntervalChange = (value: number) => {
    if (value === undefined) return
    props.onSettingChange({
      id: props.id,
      config: props.config.set('refreshInterval', value),
    })
  }

  const handleMaxPositionCountChange = (value: number) => {
    if (value === undefined) return
    props.onSettingChange({
      id: props.id,
      config: props.config.set('maxPositionCount', value),
    })
  }

  const handleMap2dSelected = (useMapWidgetIds: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds,
    })
  }

  const handleMap3dSelected = (ids: string[]) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('sceneWidgetId', ids?.[0] ?? ''),
    })
  }

  const sceneWidgetIds = props.config.sceneWidgetId
    ? Immutable([props.config.sceneWidgetId])
    : Immutable([])

  return (
    <>
      <SettingSection
        title={props.intl.formatMessage({
          id: 'fetchUrlLabel',
          defaultMessage: defaultI18nMessages.fetchUrlLabel,
        })}
      >
        <SettingRow>
          <TextInput
            id='fetchUrlInput'
            style={{ width: '100%' }}
            value={props.config.fetchUrl ?? ''}
            placeholder={props.intl.formatMessage({
              id: 'fetchUrlPlaceholder',
              defaultMessage: defaultI18nMessages.fetchUrlPlaceholder,
            })}
            onChange={handleFetchUrlChange}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={props.intl.formatMessage({
          id: 'refreshIntervalLabel',
          defaultMessage: defaultI18nMessages.refreshIntervalLabel,
        })}
      >
        <SettingRow>
          <NumericInput
            id='refreshIntervalInput'
            value={props.config.refreshInterval}
            placeholder={props.intl.formatMessage({
              id: 'refreshIntervalPlaceholder',
              defaultMessage: defaultI18nMessages.refreshIntervalPlaceholder,
            })}
            onChange={handleRefreshIntervalChange}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={props.intl.formatMessage({
          id: 'maxPositionCountLabel',
          defaultMessage: defaultI18nMessages.maxPositionCountLabel,
        })}
      >
        <SettingRow>
          <NumericInput
            id='maxPositionCountInput'
            value={props.config.maxPositionCount}
            placeholder={props.intl.formatMessage({
              id: 'maxPositionCountPlaceholder',
              defaultMessage: defaultI18nMessages.maxPositionCountPlaceholder,
            })}
            onChange={handleMaxPositionCountChange}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={props.intl.formatMessage({
          id: 'selectMap2dLabel',
          defaultMessage: defaultI18nMessages.selectMap2dLabel,
        })}
      >
        <SettingRow>
          <MapWidgetSelector
            onSelect={handleMap2dSelected}
            useMapWidgetIds={props.useMapWidgetIds}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={props.intl.formatMessage({
          id: 'selectMap3dLabel',
          defaultMessage: defaultI18nMessages.selectMap3dLabel,
        })}
      >
        <SettingRow>
          <MapWidgetSelector
            onSelect={handleMap3dSelected}
            useMapWidgetIds={sceneWidgetIds}
          />
        </SettingRow>
      </SettingSection>
    </>
  )
}
