import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";

import type Geometry from "@arcgis/core/geometry/Geometry";

import type { RootState } from "../../store";
import useOrbitTrackerSketch from "../../hooks/use-orbit-tracker-sketch";
import {
  calculateSatellitePasses,
  type SatellitePass,
} from "../../lib/orbit-tracker/calculate-satellite-passes";

const DEFAULT_BUFFER_KM = 100;
const MAX_RANGE_MS = 6 * 24 * 60 * 60 * 1000;

const pad2 = (n: number) => String(n).padStart(2, "0");

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const toIsoTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const combineDateAndTime = (isoDate: string, isoTime: string): Date | null => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(isoTime);
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  const dt = new Date(`${isoDate}T${pad2(h)}:${pad2(m)}:00`);
  return Number.isFinite(dt.getTime()) ? dt : null;
};

const readDatePickerValue = (event: unknown): string => {
  const target = (event as CustomEvent).target as unknown as {
    value?: string | string[];
  };
  const raw = target?.value;
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
};

const readTimePickerValue = (event: unknown): string => {
  const target = (event as CustomEvent).target as unknown as { value?: string };
  return target?.value ?? "";
};

const readNumberValue = (event: unknown): string => {
  const target = (event as CustomEvent).target as unknown as { value?: string };
  return target?.value ?? "";
};

export default function SatelliteOrbitTrackerComponent() {
  const rootRef = useRef<HTMLElement | null>(null);
  const sketchRef = useRef<HTMLElement | null>(null);
  const [sceneElement, setSceneElement] = useState<HTMLElement | null>(null);

  const selectedSatellites = useSelector(
    (state: RootState) => state.satellites.selected,
  );

  const [bufferKm, setBufferKm] = useState(DEFAULT_BUFFER_KM);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SatellitePass[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setSceneElement(rootRef.current?.closest("arcgis-scene") ?? null);
  }, []);

  const { point, ready, clearPoint } = useOrbitTrackerSketch({
    sceneElement,
    sketchElement: sketchRef.current,
    bufferKm,
  });

  const validation = useMemo(() => {
    const hasPoint = Boolean(point);
    const isBufferValid = Number.isFinite(bufferKm) && bufferKm >= 10;
    const hasSatellites = selectedSatellites.length > 0;

    const start =
      startDate && startTime ? combineDateAndTime(startDate, startTime) : null;
    const end =
      endDate && endTime ? combineDateAndTime(endDate, endTime) : null;

    const isRangeValid = Boolean(
      start &&
      end &&
      end.getTime() > start.getTime() &&
      end.getTime() - start.getTime() <= MAX_RANGE_MS,
    );

    return {
      hasPoint,
      isBufferValid,
      hasSatellites,
      isRangeValid,
      start,
      end,
      canRun:
        hasPoint &&
        isBufferValid &&
        hasSatellites &&
        isRangeValid &&
        !isRunning,
    };
  }, [
    point,
    bufferKm,
    selectedSatellites,
    startDate,
    endDate,
    startTime,
    endTime,
    isRunning,
  ]);

  const handleSetNow = () => {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    setStartDate(toIsoDate(now));
    setEndDate(toIsoDate(later));
    setStartTime(toIsoTime(now));
    setEndTime(toIsoTime(later));
  };

  const handleRun = async () => {
    if (!validation.canRun) return;

    const { start, end } = validation;
    if (!start || !end || !point) return;

    setError(null);
    setIsRunning(true);

    try {
      const passes = await calculateSatellitePasses({
        satellites: selectedSatellites,
        start,
        end,
        stepMs: 60_000,
        aoiGeometry: point as unknown as Geometry,
        aoiBufferKm: bufferKm,
      });

      setResults(passes);
      setDialogOpen(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore durante il calcolo",
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <main
        ref={(el) => {
          rootRef.current = el;
        }}
        className="p-3 select-none max-w-[320px] text-sm"
      >
        <p className="text-base font-semibold">Satellite Orbit Tracker</p>

        <section className="mt-2 mb-3 flex gap-2 justify-between">
          <arcgis-sketch
            ref={(el) => {
              sketchRef.current = el;
            }}
            toolbar-kind="docked"
            creation-mode="single"
            availableCreateTools={["point"]}
            hideUndoRedoMenu
            hideSettingsMenu
          />

          <div className="mt-2 text-xs">
            {point ? (
              <div className="flex gap-3">
                <div className="flex flex-col">
                  <p>
                    LAT: <b>{(point.latitude ?? 0).toFixed(5)}</b>
                  </p>
                  <p>
                    LON: <b>{(point.longitude ?? 0).toFixed(5)}</b>
                  </p>
                </div>
                <calcite-button
                  appearance="outline"
                  kind="danger"
                  scale="s"
                  onClick={clearPoint}
                >
                  <calcite-icon className="relative top-[1px]" icon="trash" scale="s"></calcite-icon>
                </calcite-button>
              </div>
            ) : (
              <span className="opacity-60">
                {ready
                  ? "Seleziona un punto sulla mappa."
                  : "Inizializzazione..."}
              </span>
            )}
          </div>
        </section>

        <section className="grid mb-3">
          <calcite-label>
            Area di interesse (km)
            <calcite-input-number
              min={10}
              step={1}
              integer
              number-button-type="horizontal"
              value={String(bufferKm)}
              disabled={isRunning}
              oncalciteInputNumberInput={(e: unknown) => {
                const v = Number(readNumberValue(e));
                if (Number.isFinite(v)) setBufferKm(v);
              }}
            />
          </calcite-label>

          <div className="grid grid-cols-2 gap-2">
            <calcite-label>
              Data inizio
              <calcite-input-date-picker
                value={startDate}
                disabled={isRunning}
                overlay-positioning="fixed"
                oncalciteInputDatePickerChange={(e: unknown) => {
                  setStartDate(readDatePickerValue(e));
                }}
              />
            </calcite-label>

            <calcite-label>
              Data fine
              <calcite-input-date-picker
                value={endDate}
                disabled={isRunning}
                overlay-positioning="fixed"
                oncalciteInputDatePickerChange={(e: unknown) => {
                  setEndDate(readDatePickerValue(e));
                }}
              />
            </calcite-label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <calcite-label>
              Ora inizio
              <calcite-input-time-picker
                hour-format="24"
                step={60}
                value={startTime}
                disabled={isRunning}
                oncalciteInputTimePickerChange={(e: unknown) => {
                  setStartTime(readTimePickerValue(e));
                }}
              />
            </calcite-label>

            <calcite-label>
              Ora fine
              <calcite-input-time-picker
                hour-format="24"
                step={60}
                value={endTime}
                disabled={isRunning}
                oncalciteInputTimePickerChange={(e: unknown) => {
                  setEndTime(readTimePickerValue(e));
                }}
              />
            </calcite-label>
          </div>

          {!validation.isRangeValid && (startDate || endDate) ? (
            <p className="text-[11px] text-red-200/90">
              Intervallo non valido: la fine deve essere successiva all'inizio
              (max 6 giorni).
            </p>
          ) : null}

          {!validation.hasSatellites ? (
            <p className="text-[11px] text-red-200/90">
              Seleziona almeno un satellite dalla sidebar.
            </p>
          ) : null}

          <calcite-button
            className="mt-2"
            width="full"
            appearance="outline"
            kind="neutral"
            disabled={isRunning}
            onClick={handleSetNow}
          >
            1 ora da adesso
          </calcite-button>
        </section>

        <section className="grid gap-2">
          <calcite-button
            width="full"
            kind="brand"
            disabled={!validation.canRun}
            loading={isRunning}
            onClick={handleRun}
          >
            Avvia calcolo
          </calcite-button>

          {results.length > 0 ? (
            <calcite-button
              width="full"
              appearance="outline"
              kind="neutral"
              onClick={() => setDialogOpen(true)}
            >
              Apri risultati ({results.length})
            </calcite-button>
          ) : null}
        </section>

        {error ? (
          <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-2 py-2 text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </main>

      {createPortal(
        <calcite-dialog
          heading="Risultati"
          open={dialogOpen}
          modal
          oncalciteDialogClose={() => setDialogOpen(false)}
        >
          <div className="px-3 py-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">Totale</span>
              <span className="opacity-80">{results.length}</span>
            </div>

            {results.length === 0 ? (
              <p className="opacity-60">Nessun risultato.</p>
            ) : (
              <ul className="max-h-64 overflow-auto grid gap-1">
                {results.map((r, idx) => (
                  <li
                    key={`${r.satName}-${r.startTimestamp}-${idx}`}
                    className="rounded bg-white/5 px-2 py-2"
                  >
                    <div className="font-medium">{r.satName}</div>
                    <div className="text-[11px] opacity-80">
                      {new Date(r.startTimestamp).toLocaleString()}
                      {" → "}
                      {new Date(r.endTimestamp).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </calcite-dialog>,
        document.body,
      )}
    </>
  );
}
