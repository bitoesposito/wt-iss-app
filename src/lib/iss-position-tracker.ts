import type { AppDispatch } from "../store";
import { addIssPosition } from "../store/iss-slice";

const ISS_ENDPOINT = "http://api.open-notify.org/iss-now.json";
// it returns {"timestamp": 1775729546, "message": "success", "iss_position": {"latitude": "2.7231", "longitude": "-68.2345"}}

export function fetchIssPosition() {
  return async (dispatch: AppDispatch) => {
    try {
      const response = await fetch(ISS_ENDPOINT);
      if (!response.ok) {
        return;
      }

      const data: {
        timestamp: number;
        message: string;
        iss_position?: { latitude: string; longitude: string };
      } = await response.json();

      if (data.message !== "success" || !data.iss_position) {
        return;
      }

      const latitude = Number.parseFloat(data.iss_position.latitude);
      const longitude = Number.parseFloat(data.iss_position.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      dispatch(
        addIssPosition({
          latitude,
          longitude,
          timestamp: data.timestamp,
        }),
      );
    } catch {
      return;
    }
  };
}
