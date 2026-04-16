import { useMemo, useState } from "react";
import type { TleSatellite } from "../types";
import { getSatelliteKey } from "../types";

import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-checkbox";
import "@esri/calcite-components/components/calcite-button";

interface SatelliteSidebarProps {
  allSatellites: TleSatellite[];
  selectedSatellites: TleSatellite[];
  onToggleSatellite: (sat: TleSatellite) => void;
  onSelectAll: (satellites: TleSatellite[]) => void;
  onClearAll: () => void;
  onCenterSatellite: (sat: TleSatellite) => void;
}

export default function SatelliteSidebar({
  allSatellites,
  selectedSatellites,
  onToggleSatellite,
  onSelectAll,
  onClearAll,
  onCenterSatellite,
}: SatelliteSidebarProps) {
  const [query, setQuery] = useState("");

  const selectedKeySet = useMemo(
    () => new Set(selectedSatellites.map(getSatelliteKey)),
    [selectedSatellites],
  );

  const filteredSatellites = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return allSatellites;
    return allSatellites.filter((sat) =>
      sat.name.toLowerCase().includes(trimmed),
    );
  }, [query, allSatellites]);

  const handleSelectAll = () => {
    const trimmed = query.trim();

    if (!trimmed) {
      onSelectAll(allSatellites);
      return;
    }

    const byKey = new Map(
      selectedSatellites.map((sat) => [getSatelliteKey(sat), sat]),
    );
    for (const sat of filteredSatellites) {
      byKey.set(getSatelliteKey(sat), sat);
    }
    onSelectAll([...byKey.values()]);
  };

  return (
    <div className="d-flex flex-column h-100">
      <div className="px-3 pt-2 pb-1">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span
            className="font-weight-bold text-uppercase"
            style={{ fontSize: "0.8rem", letterSpacing: "0.05em" }}
          >
            Satellite Map
          </span>
          <span className="text-disabled" style={{ fontSize: "0.75rem" }}>
            {selectedSatellites.length}/{allSatellites.length}
          </span>
        </div>

        <calcite-input-text
          className="mb-2"
          clearable
          icon="search"
          label="Filter satellites"
          placeholder="Filter satellites..."
          value={query}
          oncalciteInputTextInput={(event: CustomEvent) => {
            const value = (event.target as unknown as { value?: string }).value;
            setQuery(value ?? "");
          }}
        />

        <div className="d-flex gap-1 mb-2">
          <calcite-button
            className="btn btn-sm btn-outline-primary flex-fill"
            appearance="outline"
            kind="brand"
            scale="s"
            onClick={() => {
              handleSelectAll();
            }}
            label="Select all satellites"
          >
            Select All
          </calcite-button>
          <calcite-button
            className="btn btn-sm btn-outline-secondary flex-fill"
            appearance="outline"
            kind="neutral"
            scale="s"
            onClick={() => {
              onClearAll();
            }}
            disabled={selectedSatellites.length === 0}
            label="Clear selected satellites"
          >
            Clear
          </calcite-button>
        </div>
      </div>

      <hr className="mx-3 my-0" />

      <div
        className="flex flex-col flex-fill px-3 pt-2"
        style={{ overflowY: "auto", height: "100%", minHeight: 0 }}
      >
        {filteredSatellites.map((sat) => {
          const key = getSatelliteKey(sat);
          const isSelected = selectedKeySet.has(key);

          return (
            <div key={key} className="flex items-center py-1">
              <calcite-checkbox
                checked={isSelected}
                label={`Select ${sat.name}`}
                oncalciteCheckboxChange={() => {
                  onToggleSatellite(sat);
                }}
                className="mr-2"
              />
              <span
                className="text-truncate flex-fill"
                style={{ cursor: "pointer" }}
                title={sat.name}
                role="button"
                tabIndex={0}
                aria-label={`Center on ${sat.name}`}
                onClick={() => {
                  onCenterSatellite(sat);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCenterSatellite(sat);
                  }
                }}
              >
                {sat.name}
              </span>
            </div>
          );
        })}

        {filteredSatellites.length === 0 && (
          <div
            className="text-disabled text-center py-3"
            style={{ fontSize: "0.8rem" }}
          >
            No satellites found
          </div>
        )}
      </div>
    </div>
  );
}
