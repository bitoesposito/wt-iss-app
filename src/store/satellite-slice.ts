import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { TleSatellite } from "../types";

type SatelliteState = {
  positions: TleSatellite[];
  selected: TleSatellite[];
  activeSatelliteKey: string | null;
};

const initialState: SatelliteState = {
  positions: [],
  selected: [],
  activeSatelliteKey: null,
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
    filterSatellitePositions: (state, action: PayloadAction<string>) => {
      state.positions = state.positions.filter((satellite) => satellite.name.toLowerCase().includes(action.payload.toLowerCase()));
    },
  },
});

export const {
  setSatellitePositions,
  clearSatellitePositions,
  setSelectedSatellites,
  clearSelectedSatellites,
  setActiveSatelliteKey,
  clearActiveSatelliteKey,
} = satelliteSlice.actions;
export default satelliteSlice.reducer;
