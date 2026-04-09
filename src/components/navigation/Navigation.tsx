import { useDispatch } from "react-redux";
import { setViewMode } from "../../store/view-slice";
import type { AppDispatch } from "../../store";

export default function NavigationComponent() {
  const dispatch = useDispatch<AppDispatch>();
  return (
    <calcite-navigation slot="header">
      
      <calcite-menu slot="content-end" label="Satellite tracker">
        <calcite-menu-item
          text="ISS"
          label="ISS"
          icon-start="sky-plot"
          text-enabled
        ></calcite-menu-item>
        <calcite-menu-item
          text="Satellite"
          label="Satellite"
          icon-start="buffer-point"
          text-enabled
          onClick={() => dispatch(setViewMode("satellite"))}
        ></calcite-menu-item>
      </calcite-menu>
    </calcite-navigation>
  );
}
