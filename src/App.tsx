// React
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";
import { useEffect } from "react";

// Libs
import { fetchIssPosition } from "./lib/iss-position-tracker";
import { fetchStationsTle } from "./lib/satellite-position-tracker";
import { setSatellitePositions } from "./store/satellite-slice";

// Components
import MapComponent from "./components/map/Map";
import SidebarComponent from "./components/sidebar/Sidebar";
import NavigationComponent from "./components/navigation/Navigation";

// Calcite Components
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-navigation";
import "@esri/calcite-components/components/calcite-navigation-logo";
import "@esri/calcite-components/components/calcite-menu";
import "@esri/calcite-components/components/calcite-menu-item";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-segmented-control";
import "@esri/calcite-components/components/calcite-segmented-control-item";

export function App(): React.JSX.Element {

  const dispatch = useDispatch<AppDispatch>();
  const viewMode = useSelector((state: RootState) => state.viewMode);
  const satellitePositionsCount = useSelector(
    (state: RootState) => state.satellites.positions.length,
  );

  useEffect(() => {
      dispatch(fetchIssPosition());
      const interval = setInterval(() => dispatch(fetchIssPosition()), 10000);
      return () => clearInterval(interval);
  }, [dispatch]);

  useEffect(() => {
    if (viewMode.viewMode !== "satellite") return;
    if (satellitePositionsCount > 0) return;

    let isCancelled = false;

    const run = async () => {
      try {
        const satellites = await fetchStationsTle();
        if (isCancelled) return;
        dispatch(setSatellitePositions(satellites));
      } catch {
        return;
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [dispatch, satellitePositionsCount, viewMode]);

  return (
    <calcite-shell>
      <SidebarComponent />
      <MapComponent />
    </calcite-shell>
  );
}
