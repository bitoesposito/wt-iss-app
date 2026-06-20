import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { SatelliteState, TleSatellite } from "../types";

const initialState: SatelliteState = {
  positions: [],
  selected: [],
  activeSatelliteKey: null,
  status: "idle",
  error: null,
};

export const satelliteSlice = createSlice({
  name: "satellites",
  initialState,
  reducers: {
    setSatellitesLoading: (state) => {
      state.status = "loading";
      state.error = null;
    },
    setSatellitePositions: (state, action: PayloadAction<TleSatellite[]>) => {
      state.positions = action.payload;
      state.status = "ready";
      state.error = null;
    },
    setSatellitesError: (state, action: PayloadAction<string>) => {
      state.status = "error";
      state.error = action.payload;
    },
    setSelectedSatellites: (state, action: PayloadAction<TleSatellite[]>) => {
      state.selected = action.payload;
    },
    clearSelectedSatellites: (state) => {
      state.selected = [];
    },
    setActiveSatelliteKey: (state, action: PayloadAction<string | null>) => {
      state.activeSatelliteKey = action.payload;
    },
    clearActiveSatelliteKey: (state) => {
      state.activeSatelliteKey = null;
    },
  },
});

export const {
  setSatellitesLoading,
  setSatellitePositions,
  setSatellitesError,
  setSelectedSatellites,
  clearSelectedSatellites,
  setActiveSatelliteKey,
  clearActiveSatelliteKey,
} = satelliteSlice.actions;
export default satelliteSlice.reducer;
