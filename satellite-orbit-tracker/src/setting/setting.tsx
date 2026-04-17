import type { AllWidgetSettingProps } from 'jimu-for-builder'
import {
  MapWidgetSelector,
  SettingSection,
  SettingRow,
} from 'jimu-ui/advanced/setting-components'
import { TextInput } from 'jimu-ui'

import type { IMConfig } from '../config'
import defaultI18nMessages from './translations/default'

const fullWidthStyle = { width: '100%' }
const hintStyle = { fontSize: 12, opacity: 0.7 }

/**
 * Settings panel for the Satellite Orbit Tracker widget. The channel id
 * must match the one exposed by the upstream Satellite Map widget so the
 * two widgets can share a selection without relying on globals.
 */
export default function Setting(props: AllWidgetSettingProps<IMConfig>): React.ReactElement {
  const handleMapSelected = (useMapWidgetIds: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds,
    })
  }

  const handleChannelIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('channelId', event.target.value),
    })
  }

  return (
    <>
      <SettingSection
        title={props.intl.formatMessage({
          id: 'selectMapLabel',
          defaultMessage: defaultI18nMessages.selectMapLabel,
        })}
      >
        <SettingRow>
          <MapWidgetSelector
            onSelect={handleMapSelected}
            useMapWidgetIds={props.useMapWidgetIds}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title={props.intl.formatMessage({
          id: 'channelIdLabel',
          defaultMessage: defaultI18nMessages.channelIdLabel,
        })}
      >
        <SettingRow>
          <TextInput
            id='channelIdInput'
            style={fullWidthStyle}
            value={props.config.channelId ?? ''}
            placeholder={props.intl.formatMessage({
              id: 'channelIdPlaceholder',
              defaultMessage: defaultI18nMessages.channelIdPlaceholder,
            })}
            onChange={handleChannelIdChange}
          />
        </SettingRow>
        <SettingRow>
          <span style={hintStyle}>
            {props.intl.formatMessage({
              id: 'channelIdDescription',
              defaultMessage: defaultI18nMessages.channelIdDescription,
            })}
          </span>
        </SettingRow>
      </SettingSection>
    </>
  )
}
