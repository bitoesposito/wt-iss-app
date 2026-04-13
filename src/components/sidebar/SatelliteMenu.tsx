import { useMemo, useState } from "react";
import type { AppDispatch, RootState } from "../../store";
import {
  setActiveSatelliteKey,
  setSelectedSatellites,
} from "../../store/satellite-slice";

export default function SatelliteSidebarComponent({
  satellitePositions,
  selectedSatellites,
  dispatch,
}: {
  satellitePositions: RootState["satellites"]["positions"];
  selectedSatellites: RootState["satellites"]["selected"];
  dispatch: AppDispatch;
}) {
  const [query, setQuery] = useState("");

  const getSatelliteKey = (sat: (typeof satellitePositions)[number]) => {
    return `${sat.noradId ?? "no-norad"}-${sat.name}`;
  };

  const selectedKeySet = useMemo(() => {
    return new Set(selectedSatellites.map(getSatelliteKey));
  }, [selectedSatellites]);

  const filteredSatellites = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return satellitePositions;

    return satellitePositions.filter((sat) =>
      sat.name.toLowerCase().includes(trimmed),
    );
  }, [query, satellitePositions]);

  const handleCenterSatellite = (
    satellitePosition: (typeof satellitePositions)[number],
  ) => {
    const key = getSatelliteKey(satellitePosition);
    dispatch(setActiveSatelliteKey(key));

    if (selectedKeySet.has(key)) return;
    dispatch(setSelectedSatellites([...selectedSatellites, satellitePosition]));
  };

  // Click su singolo satellite: toggle (aggiungi/rimuovi) dalla selezione.
  const handleToggleSatellite = (
    satellitePosition: (typeof satellitePositions)[number],
  ) => {
    const key = getSatelliteKey(satellitePosition);
    const isSelected = selectedKeySet.has(key);

    if (isSelected) {
      dispatch(
        setSelectedSatellites(
          selectedSatellites.filter((s) => getSatelliteKey(s) !== key),
        ),
      );
      return;
    }

    dispatch(setActiveSatelliteKey(key));
    dispatch(setSelectedSatellites([...selectedSatellites, satellitePosition]));
  };

  // Seleziona tutti i satelliti caricati.
  const handleSelectAll = () => {
    const trimmed = query.trim();
    const satellitesToSelect = trimmed
      ? filteredSatellites
      : satellitePositions;

    if (!trimmed) {
      dispatch(setSelectedSatellites(satellitesToSelect));
      return;
    }

    const byKey = new Map(
      selectedSatellites.map((sat) => [getSatelliteKey(sat), sat]),
    );

    for (const sat of satellitesToSelect) {
      byKey.set(getSatelliteKey(sat), sat);
    }

    dispatch(setSelectedSatellites([...byKey.values()]));
  };

  // Pulisce tutta la selezione.
  const handleClearAll = () => {
    dispatch(setSelectedSatellites([]));
  };

  return (
    <calcite-list-item-group className="h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0">
        <div className="flex gap-2 justify-between w-full pr-1 mb-2">
          <p className="text-sm font-semibold px-3 whitespace-nowrap">
            MAPPA SATELLITI
          </p>
          <p className="text-sm whitespace-nowrap px-2">
            {selectedSatellites.length}/{satellitePositions.length} satelliti
          </p>
        </div>

        <div className="flex mb-2 md:flex-col">
          <calcite-input-text
            placeholder="Filtra satelliti"
            value={query}
            className="px-3 flex-1"
            oncalciteInputTextInput={(event: CustomEvent) => {
              const value = (event.target as unknown as { value?: string })
                .value;
              setQuery(value ?? "");
            }}
          ></calcite-input-text>

          <div id="mobile-actions" className="flex md:hidden">
            <calcite-action
              className="flex-1"
              icon="check-circle"
              text-enabled={false}
              text="Seleziona tutti"
              scale="s"
              onClick={handleSelectAll}
            ></calcite-action>
            <calcite-action
              className="flex-1"
              icon="trash"
              text-enabled={false}
              text="Pulisci"
              scale="s"
              onClick={handleClearAll}
            ></calcite-action>
          </div>

          <div id="desktop-actions" className="hidden md:flex px-3 gap-1">
            <calcite-action
              className="flex-1"
              icon="check-circle"
              text-enabled
              text="Seleziona tutti"
              scale="s"
              onClick={handleSelectAll}
            ></calcite-action>
            <calcite-action
              className="flex-1"
              icon="trash"
              text-enabled
              text="Pulisci"
              scale="s"
              onClick={handleClearAll}
            ></calcite-action>
          </div>
        </div>
      </header>

      <hr className="mx-3 mb-3 shrink-0" />

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto md:max-h-[calc(100vh-15rem)]">
        {filteredSatellites.map((satellitePosition) => {
          const key = getSatelliteKey(satellitePosition);
          const isSelected = selectedKeySet.has(key);
          return (
            <calcite-label
              className="px-3 cursor-pointer select-none"
              layout="inline"
              key={key}
            >
              <calcite-checkbox
                checked={isSelected}
                oncalciteCheckboxChange={() =>
                  handleToggleSatellite(satellitePosition)
                }
              ></calcite-checkbox>
              <span
                className="text-sm overflow-hidden text-ellipsis whitespace-nowrap"
                title={satellitePosition.name}
                role="button"
                tabIndex={0}
                aria-label={`Centra ${satellitePosition.name}`}
                onClick={() => handleCenterSatellite(satellitePosition)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleCenterSatellite(satellitePosition);
                  }
                }}
              >
                {satellitePosition.name}
              </span>
            </calcite-label>
          );
        })}
      </main>
      </div>
    </calcite-list-item-group>
  );
}
