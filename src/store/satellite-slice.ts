import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { TleSatellite } from "../types";

type SatelliteState = {
  positions: TleSatellite[];
};

const initialState: SatelliteState = {
  positions: [],
};

export const satelliteSlice = createSlice({
  name: "satellites",
  initialState,
  reducers: {
    setSatellitePositions: (state, action: PayloadAction<TleSatellite[]>) => {
      state.positions = action.payload;
    },
    clearSatellitePositions: (state) => {
      state.positions = [];
    },
  },
});

export const { setSatellitePositions, clearSatellitePositions } = satelliteSlice.actions;
export default satelliteSlice.reducer;
