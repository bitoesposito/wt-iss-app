import { useDispatch, useSelector } from "react-redux";
import { setViewMode } from "../../store/view-slice";
import type { AppDispatch, RootState } from "../../store";

export default function NavbarComponent() {
  const dispatch = useDispatch<AppDispatch>();
  const viewMode = useSelector((state: RootState) => state.viewMode.viewMode);
  return (
    <nav className="flex gap-3 justify-between p-3">
      <div className="flex gap-2 items-center">
        <img
          src="logo.svg"
          alt="Logo"
          className="h-6"
          aria-label="Satellite Tracker"
        />
        <div className="h-8 w-px border-r border-slate-200"></div>
        <img
          src="esri.svg"
          alt="Esri"
          className="invert h-6"
          aria-label="Esri"
        />
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
    </nav>
  );
}
