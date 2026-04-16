/** @jsx jsx */
import { jsx, urlUtils, type AllWidgetProps } from "jimu-core";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { type JimuMapView, JimuMapViewComponent } from "jimu-arcgis";
import type { IMConfig } from "../config";

import GraphicsLayer from "esri/layers/GraphicsLayer";
import Graphic from "esri/Graphic";
import Point from "esri/geometry/Point";
import SimpleMarkerSymbol from "esri/symbols/SimpleMarkerSymbol";
import PointSymbol3D from "esri/symbols/PointSymbol3D";
import ObjectSymbol3DLayer from "esri/symbols/ObjectSymbol3DLayer";

import t from "./translations/default";

import "@esri/calcite-components/components/calcite-icon";
import "@esri/calcite-components/components/calcite-action-bar";
import "@esri/calcite-components/components/calcite-action";

interface IssPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
}

const LAYER_2D_ID = "iss-tracker-2d";
const LAYER_3D_ID = "iss-tracker-3d";

const markerSymbol2d = new SimpleMarkerSymbol({
  style: "circle",
  color: [59, 130, 246, 0.85],
  size: 8,
  outline: { color: [255, 255, 255, 0.9], width: 1 },
});

export default function Widget(props: AllWidgetProps<IMConfig>) {
  const { config, useMapWidgetIds } = props;
  const map2dWidgetId = useMapWidgetIds?.[0];
  const map3dWidgetId = config?.sceneWidgetId || undefined;

  const issModelUrl = useMemo(() => {
    return `${urlUtils.getFixedRootPath()}widgets/iss-tracker/dist/runtime/assets/iss-model.glb`;
  }, []);

  const issSymbol3d = useMemo(() => {
    if (!issModelUrl) return null;
    return new PointSymbol3D({
      symbolLayers: [
        new ObjectSymbol3DLayer({
          resource: { href: issModelUrl },
          height: 300000,
        }),
      ],
    });
  }, [issModelUrl]);

  const [positions, setPositions] = useState<IssPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const layer2dRef = useRef<GraphicsLayer | null>(null);
  const layer3dRef = useRef<GraphicsLayer | null>(null);
  const issGraphic3dRef = useRef<Graphic | null>(null);
  const jmv2dRef = useRef<JimuMapView | null>(null);
  const jmv3dRef = useRef<JimuMapView | null>(null);

  const getOrCreateLayer = useCallback(
    (
      jmv: JimuMapView,
      id: string,
      title: string,
      elevationMode?: string,
    ): GraphicsLayer => {
      const existing = jmv.view.map.findLayerById(id) as GraphicsLayer;
      if (existing) return existing;

      const opts: __esri.GraphicsLayerProperties = { id, title };
      if (elevationMode) {
        opts.elevationInfo = { mode: elevationMode as any };
      }

      const layer = new GraphicsLayer(opts);
      jmv.view.map.add(layer);
      return layer;
    },
    [],
  );

  const handle2dViewChange = useCallback(
    (jmv: JimuMapView) => {
      if (!jmv) return;
      jmv2dRef.current = jmv;
      jmv.whenJimuMapViewLoaded().then(() => {
        layer2dRef.current = getOrCreateLayer(
          jmv,
          LAYER_2D_ID,
          "ISS Positions",
        );
      });
    },
    [getOrCreateLayer],
  );

  const handle3dViewChange = useCallback(
    (jmv: JimuMapView) => {
      if (!jmv) return;
      jmv3dRef.current = jmv;
      jmv.whenJimuMapViewLoaded().then(() => {
        layer3dRef.current = getOrCreateLayer(
          jmv,
          LAYER_3D_ID,
          "ISS 3D Model",
          "absolute-height",
        );
        issGraphic3dRef.current = null;
      });
    },
    [getOrCreateLayer],
  );

  const addPointTo2d = useCallback((pos: IssPosition) => {
    const layer = layer2dRef.current;
    if (!layer) return;

    layer.add(
      new Graphic({
        geometry: new Point({
          longitude: pos.longitude,
          latitude: pos.latitude,
          spatialReference: { wkid: 4326 },
        }),
        symbol: markerSymbol2d,
        attributes: { timestamp: pos.timestamp },
      }),
    );
  }, []);

  const updateIssModel = useCallback(
    (pos: IssPosition) => {
      const layer = layer3dRef.current;
      if (!layer) return;
      if (!issSymbol3d) return;

      const point = new Point({
        longitude: pos.longitude,
        latitude: pos.latitude,
        z: pos.altitude * 1000,
        spatialReference: { wkid: 4326 },
      });

      if (issGraphic3dRef.current) {
        issGraphic3dRef.current.geometry = point;
        return;
      }

      const graphic = new Graphic({ geometry: point, symbol: issSymbol3d });
      layer.add(graphic);
      issGraphic3dRef.current = graphic;
    },
    [issSymbol3d],
  );

  const fetchPosition = useCallback(async () => {
    const fetchUrl = config?.fetchUrl;
    if (!fetchUrl) return;

    setIsFetching(true);
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const data = await response.json();
      const latitude = Number(data?.latitude);
      const longitude = Number(data?.longitude);
      const altitude = Number(data?.altitude ?? 408);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Invalid ISS coordinates");
      }

      const pos: IssPosition = {
        latitude,
        longitude,
        altitude,
        timestamp: Date.now(),
      };
      const maxCount = config?.maxPositionCount ?? 300;

      setPositions((prev) => {
        const next = [...prev, pos];
        return next.length > maxCount
          ? next.slice(next.length - maxCount)
          : next;
      });

      addPointTo2d(pos);
      updateIssModel(pos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsFetching(false);
    }
  }, [
    config?.fetchUrl,
    config?.maxPositionCount,
    addPointTo2d,
    updateIssModel,
  ]);

  useEffect(() => {
    if (!config?.fetchUrl) return;

    const intervalMs = Math.max(1000, config?.refreshInterval ?? 10000);
    void fetchPosition();
    const id = window.setInterval(() => {
      void fetchPosition();
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [config?.fetchUrl, config?.refreshInterval, fetchPosition]);

  const handleClear = useCallback(() => {
    setPositions([]);
    setError(null);
    layer2dRef.current?.removeAll();
    layer3dRef.current?.removeAll();
    issGraphic3dRef.current = null;
  }, []);

  const handleLocate = useCallback(() => {
    const lastPos = positions[positions.length - 1];
    const activeJmv = jmv3dRef.current ?? jmv2dRef.current;
    if (!lastPos || !activeJmv) return;

    const is3d = activeJmv === jmv3dRef.current;
    const point = new Point({
      longitude: lastPos.longitude,
      latitude: lastPos.latitude,
      z: is3d ? lastPos.altitude * 1000 : undefined,
      spatialReference: { wkid: 4326 },
    });

    activeJmv.view.goTo(point);
  }, [positions]);

  return (
    <div className="w-100 h-100 p-3">
      {map2dWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={map2dWidgetId}
          onActiveViewChange={handle2dViewChange}
        />
      )}
      {map3dWidgetId && (
        <JimuMapViewComponent
          useMapWidgetId={map3dWidgetId}
          onActiveViewChange={handle3dViewChange}
        />
      )}

      <div className="d-flex align-items-center justify-content-between">
        <div>
          <div className="font-weight-bold">ISS Tracker</div>
          <div className="text-disabled">
            Samples: {positions.length}
            {isFetching ? " (fetching...)" : ""}
          </div>
        </div>
        
        <calcite-action-bar floating expand-disabled layout="horizontal">
            <calcite-action title="Pulisci lo storico dei punti" text="Clear" icon="x" id="clear" onClick={handleClear}></calcite-action>
            <calcite-action title="Centra la vista sull'ISS" text="Locate" icon="gps-on" id="locate" onClick={handleLocate}></calcite-action>
        </calcite-action-bar> 

      </div>

      {error && (
        <div className="mt-2" style={{ color: "var(--sys-color-error)" }}>
          {error}
        </div>
      )}

      {positions.length > 0 && (
        <div className="mt-3">
          <div className="text-disabled">Last position</div>
          <div>
            Lat: {positions[positions.length - 1].latitude.toFixed(5)} | Lon: {positions[positions.length - 1].longitude.toFixed(5)} |
            Alt: {positions[positions.length - 1].altitude.toFixed(1)} km
          </div>
        </div>
      )}

      {!map2dWidgetId && !map3dWidgetId && (
        <div className="mt-3 text-disabled">
          Select a 2D map or 3D scene in the settings panel.
        </div>
      )}
    </div>
  );
}
