import type { AppDispatch } from "../store";
import { addIssPosition } from "../store/iss-slice";

const ISS_ENDPOINT = 'https://api.wheretheiss.at/v1/satellites/25544'

export function fetchIssPosition() {
  return async (dispatch: AppDispatch) => {
    try {
      const response = await fetch(ISS_ENDPOINT);
      if (!response.ok) {
        return;
      }

      const data: {
        timestamp: number
        latitude: number
        longitude: number
        altitude: number
      } = await response.json();

      const latitude = data.latitude
      const longitude = data.longitude
      const altitude = data.altitude

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      dispatch(
        addIssPosition({
          latitude,
          longitude,
          altitude: Number.isFinite(altitude) ? altitude : undefined,
          timestamp: data.timestamp,
        }),
      );
    } catch {
      return;
    }
  };
}
