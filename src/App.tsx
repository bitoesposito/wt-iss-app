// React
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";
import { useEffect } from "react";

// Libs
import { fetchIssPosition } from "./lib/iss-position-tracker";
import { fetchStationsTle } from "./lib/satellite-position-tracker";
import { setSatellitePositions } from "./store/satellite-slice";
import { setActiveIssPositionKey } from "./store/iss-slice";

// Components
import MapComponent from "./components/map/Map";
import SidebarComponent from "./components/sidebar/Sidebar";
import NavbarComponent from "./components/navbar/Navbar";
import IssMenu from "./components/sidebar/IssMenu";
import SatelliteMenu from "./components/sidebar/SatelliteMenu";

export function App(): React.JSX.Element {
  const dispatch = useDispatch<AppDispatch>();
  const viewMode = useSelector((state: RootState) => state.viewMode.viewMode);
  const satellitePositionsCount = useSelector(
    (state: RootState) => state.satellites.positions.length,
  );
  const issPositions = useSelector((state: RootState) => state.iss.positions);
  const satellitePositions = useSelector(
    (state: RootState) => state.satellites.positions,
  );
  const selectedSatellites = useSelector(
    (state: RootState) => state.satellites.selected,
  );

  useEffect(() => {
    dispatch(fetchIssPosition());
    const interval = setInterval(() => dispatch(fetchIssPosition()), 10000);
    return () => clearInterval(interval);
  }, [dispatch]);

  useEffect(() => {
    if (viewMode !== "satellite") return;
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
      <div id="mobile" className="md:hidden flex flex-col h-screen">
        <NavbarComponent />
        <div className="h-[60dvh] shrink-0 relative overflow-hidden">
          <MapComponent />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto border-t border-slate-200">
          {viewMode === "iss" ? (
            <IssMenu
              issPositions={issPositions}
              onSetActiveIssPositionKey={(key) =>
                dispatch(setActiveIssPositionKey(key))
              }
            />
          ) : (
            <SatelliteMenu
              satellitePositions={satellitePositions}
              selectedSatellites={selectedSatellites}
              dispatch={dispatch}
            />
          )}
        </div>
      </div>
      <div id="desktop" className="md:flex flex-row hidden h-full">
        <SidebarComponent />
        <MapComponent />
      </div>
    </calcite-shell>
  );
}
