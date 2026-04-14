import { Immutable } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import {
  MapWidgetSelector,
  SettingSection,
  SettingRow,
} from 'jimu-ui/advanced/setting-components'
import type { IMConfig } from '../config'
import defaultI18nMessages from './translations/default'
import { TextInput, NumericInput } from 'jimu-ui'

export default function (props: AllWidgetSettingProps<IMConfig>) {

  function handleFetchUrlChange (event: React.ChangeEvent<HTMLInputElement>) {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('fetchUrl', event.target.value),
    })
  }

  function handleRefreshIntervalChange (value: number) {
    if (value === undefined) return
    props.onSettingChange({
      id: props.id,
      config: props.config.set('refreshInterval', value),
    })
  }

  function handleMaxPositionCountChange (value: number) {
    if (value === undefined) return
    props.onSettingChange({
      id: props.id,
      config: props.config.set('maxPositionCount', value),
    })
  }

  function handleMap2dSelected (useMapWidgetIds: string[]) {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds,
    })
  }

  function handleMap3dSelected (ids: string[]) {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('sceneWidgetId', ids?.[0] ?? ''),
    })
  }

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
            id="fetchUrlInput"
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
            type="number"
            id="refreshIntervalInput"
            value={props.config.refreshInterval}
            placeholder={props.intl.formatMessage({
              id: 'refreshIntervalPlaceholder',
              defaultMessage: defaultI18nMessages.refreshIntervalPlaceholder,
            })}
            onChange={(value) => { handleRefreshIntervalChange(value) }}
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
            type="number"
            id="maxPositionCountInput"
            value={props.config.maxPositionCount}
            placeholder={props.intl.formatMessage({
              id: 'maxPositionCountPlaceholder',
              defaultMessage: defaultI18nMessages.maxPositionCountPlaceholder,
            })}
            onChange={(value) => { handleMaxPositionCountChange(value) }}
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
            useMapWidgetIds={props.config.sceneWidgetId ? Immutable([props.config.sceneWidgetId]) : Immutable([])}
          />
        </SettingRow>
      </SettingSection>
    </>
  )
}
