// ArcGIS Components
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-navigation-toggle";
import "@arcgis/map-components/components/arcgis-compass";
import "@arcgis/map-components/components/arcgis-expand";

// Hooks
import useIssGraphicLayer from "../../hooks/use-iss-graphic-layer";

// Redux
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import type { AppDispatch } from "../../store";
import {
  clearActiveIssPositionKey,
  setActiveIssPositionKey,
} from "../../store/iss-slice";

// React
import { useCallback, useEffect, useRef } from "react";

export default function MapComponent() {
  const dispatch = useDispatch<AppDispatch>();
  const mapElementRef = useRef<HTMLElement | null>(null);
  const issPosition = useSelector((state: RootState) => state.iss.positions);
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

  useIssGraphicLayer({
    mapElement: isIssMode ? mapElementRef.current : null,
    positions: issPosition,
    activeIssPositionKey,
    onSelectIssPositionKey: handleSelectIssPositionKey,
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
        <arcgis-scene basemap="dark-gray-vector">
          <arcgis-zoom className="pb-3" slot="top-left"></arcgis-zoom>
          <arcgis-navigation-toggle
            className="pb-3"
            slot="top-left"
          ></arcgis-navigation-toggle>
          <arcgis-compass className="pb-3" slot="top-left"></arcgis-compass>
          <arcgis-expand
            className="pb-3"
            slot="top-right"
            expandIcon="sky-plot"
          >
            test
          </arcgis-expand>
        </arcgis-scene>
      )}
    </>
  );
}
