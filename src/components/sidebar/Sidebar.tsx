import { useDispatch, useSelector } from "react-redux";
import { setActiveIssPositionKey } from "../../store/iss-slice";
import type { AppDispatch, RootState } from "../../store";
import { setViewMode } from "../../store/view-slice";
import { setActiveSatelliteKey, setSelectedSatellites } from "../../store/satellite-slice";
import { useMemo, useState } from "react";

export default function SidebarComponent() {
  const dispatch = useDispatch<AppDispatch>();
  const viewMode = useSelector((state: RootState) => state.viewMode.viewMode);
  const issPositions = useSelector((state: RootState) => state.iss.positions);
  const satellitePositions = useSelector(
    (state: RootState) => state.satellites.positions,
  );
  const selectedSatellites = useSelector(
    (state: RootState) => state.satellites.selected,
  );
  return (
    <calcite-shell-panel slot="panel-start">
      <nav className="flex gap-3 justify-between p-3">
        <div className="flex gap-2 items-center">
          <img
            src="logo.svg"
            alt="Logo"
            className="h-6"
            aria-label="Satellite Tracker"
          />
          <div className="h-8 w-px border-r border-slate-200"></div>
          <img
            src="esri.svg"
            alt="Esri"
            className="invert h-6"
            aria-label="Esri"
          />
        </div>

        <calcite-segmented-control>
          <calcite-segmented-control-item
            value="iss"
            checked={viewMode === "iss"}
            onClick={() => dispatch(setViewMode("iss"))}
          >
            ISS
          </calcite-segmented-control-item>
          <calcite-segmented-control-item
            value="satellite"
            checked={viewMode === "satellite"}
            onClick={() => dispatch(setViewMode("satellite"))}
          >
            SAT
          </calcite-segmented-control-item>
        </calcite-segmented-control>
      </nav>

      <calcite-panel width="320px" className="overflow-hidden">
        <calcite-list label="View mode" className="overflow-hidden">
          {viewMode === "iss" ? (
            <IssSidebarComponent
              issPositions={issPositions}
              onSetActiveIssPositionKey={(key) =>
                dispatch(setActiveIssPositionKey(key))
              }
            />
          ) : (
            <SatelliteSidebarComponent
              satellitePositions={satellitePositions}
              selectedSatellites={selectedSatellites}
              dispatch={dispatch}
            />
          )}
        </calcite-list>
      </calcite-panel>
    </calcite-shell-panel>
  );
}

function IssSidebarComponent({
  issPositions,
  onSetActiveIssPositionKey,
}: {
  issPositions: RootState["iss"]["positions"];
  onSetActiveIssPositionKey: (key: string | null) => void;
}) {
  return (
    <calcite-list-item-group
      heading="MAPPA ISS"
      className="h-full overflow-hidden"
    >
      <div className="px-3 flex gap-2 absolute right-0 top-[1rem]">
        <calcite-icon icon="refresh" scale="s"></calcite-icon>
        <calcite-label scale="s">10 sec</calcite-label>
      </div>
      <hr className="mx-3 mb-3" />
      <div className="overflow-hidden">
        <div className="max-h-[calc(100vh-6.8rem)] overflow-y-auto">
          {issPositions.map((issPosition) => {
            const issPositionKey = `${issPosition.timestamp}-${issPosition.latitude}-${issPosition.longitude}`;
            const issPositionId = `iss-${issPositionKey}`;

            return (
              <calcite-action
                key={issPositionKey}
                id={issPositionId}
                icon="pin"
                text-enabled
                text={`${issPosition.latitude.toFixed(6)}, ${issPosition.longitude.toFixed(6)}`}
                scale="m"
                onPointerEnter={() => onSetActiveIssPositionKey(issPositionKey)}
                onPointerLeave={() => onSetActiveIssPositionKey(null)}
                onFocus={() => onSetActiveIssPositionKey(issPositionKey)}
                onBlur={() => onSetActiveIssPositionKey(null)}
              ></calcite-action>
            );
          })}
        </div>
      </div>
    </calcite-list-item-group>
  );
}

function SatelliteSidebarComponent({
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
    const trimmed = query.trim()
    const satellitesToSelect = trimmed ? filteredSatellites : satellitePositions

    if (!trimmed) {
      dispatch(setSelectedSatellites(satellitesToSelect))
      return
    }

    const byKey = new Map(
      selectedSatellites.map((sat) => [getSatelliteKey(sat), sat]),
    )

    for (const sat of satellitesToSelect) {
      byKey.set(getSatelliteKey(sat), sat)
    }

    dispatch(setSelectedSatellites([...byKey.values()]))
  };

  // Pulisce tutta la selezione.
  const handleClearAll = () => {
    dispatch(setSelectedSatellites([]));
  };

  return (
    <calcite-list-item-group heading="MAPPA SATELLITI" className="h-full">
      <div>
        <calcite-filter
          placeholder="Filtra satelliti"
          value={query}
          oncalciteFilterChange={(event: CustomEvent) => {
            const value = (event.target as unknown as { value?: string }).value;
            setQuery(value ?? "");
          }}
        ></calcite-filter>

        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <calcite-action
            icon="check-circle"
            text-enabled
            text="Seleziona tutti"
            scale="s"
            onClick={handleSelectAll}
          ></calcite-action>
          <calcite-action
            icon="trash"
            text-enabled
            text="Pulisci"
            scale="s"
            onClick={handleClearAll}
          ></calcite-action>
        </div>
      </div>

      <hr className="mx-3 mb-3" />

      <div className="flex flex-col flex-1 max-h-[calc(100vh-12.8rem)] overflow-y-auto">
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
      </div>
    </calcite-list-item-group>
  );
}
