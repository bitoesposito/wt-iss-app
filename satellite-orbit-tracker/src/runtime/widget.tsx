/** @jsx jsx */
import { jsx, type AllWidgetProps } from "jimu-core";
import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { type JimuMapView, JimuMapViewComponent } from "jimu-arcgis";
import type Geometry from "esri/geometry/Geometry";

import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-dialog";
import "@esri/calcite-components/components/calcite-icon";
import "@esri/calcite-components/components/calcite-input-date-picker";
import "@esri/calcite-components/components/calcite-input-number";
import "@esri/calcite-components/components/calcite-input-time-picker";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";

import type { IMConfig } from "../config";
import type { TleSatellite, SatellitePass } from "../types";
import { calculateSatellitePasses } from "../lib/calculate-satellite-passes";
import useAoiPoint from "../hooks/use-aoi-point";
import t from "./translations/default";

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

const formatDuration = (startMs: number, endMs: number): string => {
  const diffSec = Math.round((endMs - startMs) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

export default function Widget(props: AllWidgetProps<IMConfig>) {
  const { config, useMapWidgetIds } = props;
  const mapWidgetId = useMapWidgetIds?.[0];
  const channelId = config?.channelId;

  const [jimuMapView, setJimuMapView] = useState<JimuMapView | null>(null);
  const [selectedSatellites, setSelectedSatellites] = useState<TleSatellite[]>(
    [],
  );
  const [bufferKm, setBufferKm] = useState(DEFAULT_BUFFER_KM);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SatellitePass[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!channelId) return;

    const channelKey = `__sat_channel_${channelId}`;
    const initial = (window as any)[channelKey];
    if (Array.isArray(initial)) setSelectedSatellites(initial);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.channelId === channelId) {
        setSelectedSatellites(detail.satellites ?? []);
      }
    };

    window.addEventListener("satellite-selection-changed", handler);
    return () =>
      window.removeEventListener("satellite-selection-changed", handler);
  }, [channelId]);

  const { point, placing, layersReady, startPlacing, clearPoint } = useAoiPoint(
    {
      jimuMapView,
      bufferKm,
    },
  );

  const handleActiveViewChange = useCallback((jmv: JimuMapView) => {
    if (!jmv) return;
    jmv.whenJimuMapViewLoaded().then(() => setJimuMapView(jmv));
  }, []);

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
      if (passes.length > 0) setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.calculationError);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    setResults([]);
    setError(null);
  }, [point, bufferKm, selectedSatellites.length]);

  return (
    <div
      className="w-100 h-100 d-flex flex-column"
      style={{ overflow: "hidden" }}
    >
      {mapWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={mapWidgetId}
          onActiveViewChange={handleActiveViewChange}
        />
      )}

      {!mapWidgetId && (
        <div className="p-3">
          <calcite-notice open kind="warning" width="full">
            <span slot="message">{t.noMapSelected}</span>
          </calcite-notice>
        </div>
      )}

      {mapWidgetId && (
        <div
          className="d-flex flex-column h-100"
          style={{ overflowY: "auto", minHeight: 0 }}
        >
          {/* Title */}
          <div className="px-3 pt-2 pb-1">
            <span
              className="font-weight-bold text-uppercase"
              style={{ fontSize: "0.8rem", letterSpacing: "0.04em" }}
            >
              {t.title}
            </span>
          </div>

          {/* AOI Point */}
          <div className="px-3 py-2">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <calcite-label style={{ marginBottom: 0 }}>
                {t.aoiPointLabel}
              </calcite-label>
              {point ? (
                <div className="d-flex align-items-center gap-2">
                  <span
                    style={{ fontSize: "0.75rem", fontFamily: "monospace" }}
                  >
                    {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                  </span>
                  <calcite-button
                    appearance="transparent"
                    kind="danger"
                    icon-start="trash"
                    label={t.clearPoint}
                    disabled={isRunning || undefined}
                    onClick={clearPoint}
                  />
                </div>
              ) : (
                <calcite-button
                  appearance="solid"
                  kind="brand"
                  icon-start="pin-plus"
                  loading={placing || undefined}
                  disabled={!layersReady || isRunning || undefined}
                  onClick={startPlacing}
                >
                  {placing ? t.placing : t.place}
                </calcite-button>
              )}
            </div>

            {placing && (
              <calcite-notice open kind="info" width="full">
                <span slot="message">{t.placingPoint}</span>
              </calcite-notice>
            )}

            {!layersReady && !placing && (
              <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                {t.initializingLayers}
              </span>
            )}
          </div>

          <hr className="mx-3 my-0" />

          {/* Buffer */}
          <div className="px-3 py-2">
            <calcite-label>
              {t.bufferKmLabel}
              <calcite-input-number
                min={10}
                step={10}
                integer
                number-button-type="horizontal"
                value={String(bufferKm)}
                disabled={isRunning || undefined}
                suffix-text="km"
                oncalciteInputNumberInput={(e: CustomEvent) => {
                  const v = Number((e.target as any)?.value);
                  if (Number.isFinite(v)) setBufferKm(v);
                }}
              />
            </calcite-label>
          </div>

          <hr className="mx-3 my-0" />

          {/* Time Range */}
          <div className="px-3 py-2">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <calcite-label style={{ marginBottom: 0 }}>
                {t.timeRangeLabel}
              </calcite-label>
              <calcite-button
                appearance="outline"
                kind="neutral"
                icon-start="clock-forward"
                disabled={isRunning || undefined}
                onClick={handleSetNow}
              >
                {t.oneHourFromNow}
              </calcite-button>
            </div>

            <div className="d-flex gap-2 mb-2">
              <calcite-label className="flex-fill">
                {t.startDateLabel}
                <calcite-input-date-picker
                  value={startDate}
                  disabled={isRunning || undefined}
                  overlay-positioning="fixed"
                  oncalciteInputDatePickerChange={(e: unknown) =>
                    setStartDate(readDatePickerValue(e))
                  }
                />
              </calcite-label>
              <calcite-label className="flex-fill">
                {t.startTimeLabel}
                <calcite-input-time-picker
                  value={startTime}
                  disabled={isRunning || undefined}
                  hour-format="24"
                  step={60}
                  oncalciteInputTimePickerChange={(e: unknown) =>
                    setStartTime(readTimePickerValue(e))
                  }
                />
              </calcite-label>
            </div>

            <div className="d-flex gap-2">
              <calcite-label className="flex-fill">
                {t.endDateLabel}
                <calcite-input-date-picker
                  value={endDate}
                  disabled={isRunning || undefined}
                  overlay-positioning="fixed"
                  oncalciteInputDatePickerChange={(e: unknown) =>
                    setEndDate(readDatePickerValue(e))
                  }
                />
              </calcite-label>
              <calcite-label className="flex-fill">
                {t.endTimeLabel}
                <calcite-input-time-picker
                  value={endTime}
                  disabled={isRunning || undefined}
                  hour-format="24"
                  step={60}
                  oncalciteInputTimePickerChange={(e: unknown) =>
                    setEndTime(readTimePickerValue(e))
                  }
                />
              </calcite-label>
            </div>

            {!validation.isRangeValid && (startDate || endDate) && (
              <calcite-notice open kind="danger" width="full" className="mt-2">
                <span slot="message">{t.invalidRange}</span>
              </calcite-notice>
            )}
          </div>

          <hr className="mx-3 my-0" />

          {/* Satellites */}
          <div className="px-3 py-2">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <calcite-label style={{ marginBottom: 0 }}>
                {t.satellitesLabel}
              </calcite-label>
              <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                {selectedSatellites.length} {t.selectedSuffix}
              </span>
            </div>

            {!channelId && (
              <calcite-notice open kind="warning" width="full">
                <span slot="message">{t.noSourceWidget}</span>
              </calcite-notice>
            )}

            {channelId && selectedSatellites.length === 0 && (
              <calcite-notice open kind="info" width="full">
                <span slot="message">{t.noSatellitesSelected}</span>
              </calcite-notice>
            )}

            {selectedSatellites.length > 0 && (
              <div
                className="d-flex flex-wrap gap-1"
                style={{ maxHeight: "72px", overflowY: "auto" }}
              >
                {selectedSatellites.map((sat) => (
                  <span
                    key={sat.noradId ?? sat.name}
                    className="badge"
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 500,
                      padding: "2px 6px",
                      borderRadius: "3px",
                      backgroundColor:
                        "var(--calcite-color-foreground-2, #f3f3f3)",
                      color: "var(--calcite-color-text-2, #6a6a6a)",
                    }}
                  >
                    {sat.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <hr className="mx-3 my-0" />

          {/* Actions */}
          <div className="px-3 py-2 d-flex flex-column gap-1">
            <calcite-button
              width="full"
              kind="brand"
              disabled={!validation.canRun || undefined}
              loading={isRunning || undefined}
              onClick={handleRun}
            >
              {isRunning ? t.calculating : t.calculatePasses}
            </calcite-button>

            {results.length > 0 && (
              <calcite-button
                width="full"
                appearance="outline"
                kind="neutral"
                onClick={() => setDialogOpen(true)}
              >
                {t.openResults} ({results.length})
              </calcite-button>
            )}
          </div>

          {error && (
            <div className="px-3 pb-2">
              <calcite-notice open kind="danger" width="full">
                <span slot="message">{error}</span>
              </calcite-notice>
            </div>
          )}
        </div>
      )}

      {/* Results dialog */}
      {createPortal(
        <calcite-dialog
          heading={`${t.dialogHeading} (${results.length})`}
          open={dialogOpen || undefined}
          modal
          oncalciteDialogClose={() => setDialogOpen(false)}
        >
          {results.length === 0 ? (
            <div className="p-3">
              <calcite-notice open kind="info" width="full">
                <span slot="message">{t.noResults}</span>
              </calcite-notice>
            </div>
          ) : (
            <calcite-list label={t.dialogHeading} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {results.map((r, idx) => (
                <calcite-list-item
                  key={`${r.satName}-${r.startTimestamp}-${idx}`}
                  label={r.satName}
                  description={`${new Date(r.startTimestamp).toLocaleString()} \u2192 ${new Date(r.endTimestamp).toLocaleString()}`}
                >
                  <calcite-icon slot="content-start" icon="globe" />
                  <span
                    slot="content-end"
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    {formatDuration(r.startTimestamp, r.endTimestamp)}
                  </span>
                </calcite-list-item>
              ))}
            </calcite-list>
          )}
        </calcite-dialog>,
        document.body,
      )}
    </div>
  );
}
