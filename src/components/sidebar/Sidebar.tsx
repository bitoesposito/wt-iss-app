import { useDispatch, useSelector } from "react-redux";
import { setActiveIssPositionKey } from "../../store/iss-slice";
import type { AppDispatch, RootState } from "../../store";
import { setViewMode } from "../../store/view-slice";

export default function SidebarComponent() {
  const dispatch = useDispatch<AppDispatch>();
  const viewMode = useSelector((state: RootState) => state.viewMode.viewMode);
  const issPosition = useSelector((state: RootState) => state.iss.positions);
  const satellitePositions = useSelector(
    (state: RootState) => state.satellites.positions,
  );

  return (
    <calcite-shell-panel slot="panel-start">
      <calcite-panel width="320px">
        <div className="flex gap-3 justify-between p-3">
          <div className="flex gap-2 items-center">
            <img
              src="logo.svg"
              alt="Logo"
              className="h-6"
              label="Satellite Tracker"
            />
            <div className="h-8 w-px border-r border-slate-200"></div>
            <img src="esri.svg" alt="Esri" className="invert h-6" label="Esri"/>
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
        </div>

        <calcite-list label="View mode">
          {viewMode === "iss" ? (
            <calcite-list-item-group heading="Mappa ISS">
              <div className="px-3">
                <calcite-label scale="s">
                  Aggiornato ogni 10 secondi
                </calcite-label>
              </div>
              {issPosition.map((issPosition) => {
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
                    onPointerEnter={() =>
                      dispatch(setActiveIssPositionKey(issPositionKey))
                    }
                    onPointerLeave={() =>
                      dispatch(setActiveIssPositionKey(null))
                    }
                    onFocus={() =>
                      dispatch(setActiveIssPositionKey(issPositionKey))
                    }
                    onBlur={() => dispatch(setActiveIssPositionKey(null))}
                  ></calcite-action>
                );
              })}
            </calcite-list-item-group>
          ) : (
            <calcite-list-item-group heading="Mappa Satellite">
              {satellitePositions.map((satellitePosition) => {
                return (
                  <calcite-action
                    key={satellitePosition.noradId ?? satellitePosition.name}
                    icon="satellite0"
                    text-enabled
                    text={`${satellitePosition.name}`}
                    scale="m"
                  ></calcite-action>
                );
              })}
            </calcite-list-item-group>
          )}
        </calcite-list>
      </calcite-panel>
    </calcite-shell-panel>
  );
}
