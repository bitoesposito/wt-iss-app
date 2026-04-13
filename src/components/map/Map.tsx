// ArcGIS Components
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-navigation-toggle";
import "@arcgis/map-components/components/arcgis-compass";
import "@arcgis/map-components/components/arcgis-expand";

// Hooks
import useIssGraphicLayer from "../../hooks/use-iss-graphic";
import useSatGraphicLayer from "../../hooks/use-sat-graphic";

// Redux
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import type { AppDispatch } from "../../store";
import {
  clearActiveIssPositionKey,
  setActiveIssPositionKey,
} from "../../store/iss-slice";
import { clearActiveSatelliteKey } from "../../store/satellite-slice";

// React
import { useCallback, useEffect, useRef } from "react";
import SatelliteOrbitTrackerComponent from "../widgets/SatelliteOrbitTracker";

export default function MapComponent() {
  const dispatch = useDispatch<AppDispatch>();
  const mapElementRef = useRef<HTMLElement | null>(null);
  const sceneElementRef = useRef<HTMLElement | null>(null);
  const issPosition = useSelector((state: RootState) => state.iss.positions);
  const selectedSatellites = useSelector(
    (state: RootState) => state.satellites.selected,
  );
  const activeSatelliteKey = useSelector(
    (state: RootState) => state.satellites.activeSatelliteKey,
  );
  const activeIssPositionKey = useSelector(
    (state: RootState) => state.iss.activeIssPositionKey,
  );
  const viewMode = useSelector((state: RootState) => state.viewMode.viewMode);
  const isIssMode = viewMode === "iss";

  const handleSelectIssPositionKey = useCallback(
    (key: string | null) => {
      dispatch(setActiveIssPositionKey(key));
    },
    [dispatch],
  );

  useEffect(() => {
    if (isIssMode) return;
    dispatch(clearActiveIssPositionKey());
  }, [dispatch, isIssMode]);

  useEffect(() => {
    if (!isIssMode) return;
    dispatch(clearActiveSatelliteKey());
  }, [dispatch, isIssMode]);

  useIssGraphicLayer({
    mapElement: isIssMode ? mapElementRef.current : null,
    positions: issPosition,
    activeIssPositionKey,
    onSelectIssPositionKey: handleSelectIssPositionKey,
  });

  useSatGraphicLayer({
    mapElement: !isIssMode ? sceneElementRef.current : null,
    positions: selectedSatellites,
    activeSatelliteKey,
  });

  return (
    <>
      {isIssMode ? (
        <>
          <arcgis-map
            ref={(element) => {
              mapElementRef.current = element;
            }}
            basemap="dark-gray-vector"
          ></arcgis-map>
        </>
      ) : (
        <arcgis-scene
          ref={(element) => {
            sceneElementRef.current = element;
          }}
          basemap="dark-gray-vector"
        >
          <arcgis-zoom className="pb-3" slot="top-left"></arcgis-zoom>
          <arcgis-navigation-toggle
            className="pb-3"
            slot="top-left"
          ></arcgis-navigation-toggle>
          <arcgis-compass className="pb-3" slot="top-left"></arcgis-compass>
          <arcgis-expand
            className="pb-3"
            slot="top-right"
            mode="drawer"
            expandIcon="sky-plot"
          >
            <SatelliteOrbitTrackerComponent />
          </arcgis-expand>
        </arcgis-scene>
      )}
    </>
  );
}
