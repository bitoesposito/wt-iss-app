import { useDispatch, useSelector } from "react-redux";
import { setActiveIssPositionKey } from "../../store/iss-slice";
import type { AppDispatch, RootState } from "../../store";
import NavbarComponent from "../navbar/Navbar";
import IssSidebarComponent from "./IssMenu";
import SatelliteSidebarComponent from "./SatelliteMenu";

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
      <NavbarComponent />

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