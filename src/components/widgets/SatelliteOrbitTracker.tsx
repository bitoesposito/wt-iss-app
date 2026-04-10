// ArcGIS Widgets
import Sketch from "@arcgis/core/widgets/Sketch.js";

export default function SatelliteOrbitTrackerComponent() {
  return (
    <main className="p-3 select-none">
      <p className="text-lg font-bold">Orbit tracker</p>
      <p className="text-xs">Calcola il passaggio dei satelliti selezionati</p>
      <hr className="mt-3 opacity-[0.25]" />
      <div className="flex gap-3 items-center justify-between">
        <arcgis-sketch
          toolbar-kind="docked"
          creation-mode="single"
          availableCreateTools={["point"]}
          hideUndoRedoMenu
          hideSettingsMenu
        />
        <p className="text-xs text-red-200">
          Seleziona un punto per continuare
        </p>
      </div>
      <hr className="opacity-[0.25] mb-3" />

      <div className="flex flex-col gap-3">
        <calcite-input-number
          step="1"
          alignment="start"
          label-text="Area di interesse"
          name="buffer"
          number-button-type="horizontal"
          placeholder="100 (default)"
          scale="m"
          status="idle"
          suffix-text="km"
        ></calcite-input-number>

        <calcite-input-date-picker
          label-text="Data di interesse"
          month-style="wide"
          range
          required
          scale="m"
        ></calcite-input-date-picker>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2 whitespace-nowrap">
            <calcite-input-time-picker
              hour-format="user"
              label-text="Ora di inizio"
              required
            ></calcite-input-time-picker>
            <calcite-input-time-picker
              hour-format="user"
              label-text="Ora di fine"
              required
            ></calcite-input-time-picker>
          </div>
          <calcite-label className="flex-1">
            Azioni rapide
            <calcite-button
              kind="neutral"
              split-child="primary"
              className="relative top-[-0.1rem]"
            >
              1 ora da adesso
            </calcite-button>
          </calcite-label>
        </div>

        <calcite-button
          appearance="solid"
          kind="brand"
          split-child="primary"
          width="full"
        >
          Avvia calcolo
        </calcite-button>
      </div>
    </main>
  );
}
