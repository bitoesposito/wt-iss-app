import { createSlice } from "@reduxjs/toolkit";

// Types
import type { ViewMode } from "../types";

export const viewModeSlice = createSlice({
    name: "viewMode",
    initialState: {
        viewMode: "iss" as ViewMode
    },
    reducers: {
        setViewMode: (state, action: { payload: ViewMode }) => {
            state.viewMode = action.payload as ViewMode;
        }
    }
})

export const { setViewMode } = viewModeSlice.actions;
export default viewModeSlice.reducer;