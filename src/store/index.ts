import { configureStore } from "@reduxjs/toolkit";
import viewModeReducer from "./view-slice";
import issReducer from "./iss-slice";
import satellitesReducer from "./satellite-slice";

const store = configureStore({
  reducer: {
    viewMode: viewModeReducer,
    iss: issReducer,
    satellites: satellitesReducer,
  },
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;