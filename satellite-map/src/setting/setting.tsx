import type { AllWidgetSettingProps } from "jimu-for-builder";
import {
  MapWidgetSelector,
  SettingSection,
  SettingRow,
} from "jimu-ui/advanced/setting-components";
import type { IMConfig } from "../config";
import defaultI18nMessages from "./translations/default";
import { TextInput } from "jimu-ui";

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
  const handleFetchUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set("fetchUrl", event.target.value),
    });
  };

  const handleMapSelected = (useMapWidgetIds: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds,
    });
  };

  return (
    <>
      <SettingSection
        title={props.intl.formatMessage({
          id: "selectMapLabel",
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
          id: "fetchUrlLabel",
          defaultMessage: defaultI18nMessages.fetchUrlLabel,
        })}
      >
        <SettingRow>
          <TextInput
            id="fetchUrlInput"
            className="w-100"
            value={props.config.fetchUrl ?? ""}
            placeholder={props.intl.formatMessage({
              id: "fetchUrlPlaceholder",
              defaultMessage: defaultI18nMessages.fetchUrlPlaceholder,
            })}
            onChange={handleFetchUrlChange}
          />
        </SettingRow>
      </SettingSection>
    </>
  );
}
