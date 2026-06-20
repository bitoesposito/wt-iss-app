import type { AppDispatch } from '../store'
import { setIssTle } from '../store/iss-slice'
import type { IssTle } from '../types'

// TLE della ISS (NORAD 25544) da Celestrak: stessa fonte dei satelliti,
// senza problemi di CORS. Serve a calcolare la traiettoria orbitale.
const ISS_TLE_URL =
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle'

export async function fetchIssTle(): Promise<IssTle | null> {
  const response = await fetch(ISS_TLE_URL)
  if (!response.ok) return null

  const text = await response.text()
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  // Formato: nome / line1 / line2.
  if (lines.length < 3) return null
  return { line1: lines[1], line2: lines[2] }
}

/** Thunk: carica il TLE della ISS nello store (best-effort). */
export function loadIssTle() {
  return async (dispatch: AppDispatch) => {
    try {
      const tle = await fetchIssTle()
      if (tle) dispatch(setIssTle(tle))
    } catch {
      // Silenzioso: senza TLE non si disegna la traiettoria, il resto funziona.
    }
  }
}
