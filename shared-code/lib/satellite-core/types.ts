/**
 * Two-Line Element (TLE) satellite descriptor shared across widgets.
 *
 * @property name - Human-readable satellite name (e.g. "ISS (ZARYA)").
 * @property line1 - First line of the TLE set.
 * @property line2 - Second line of the TLE set.
 * @property noradId - NORAD catalog number, or `null` if unknown.
 */
export interface TleSatellite {
  name: string
  line1: string
  line2: string
  noradId: number | null
}

/**
 * Single satellite pass computed over an area of interest.
 *
 * @property satName - Satellite name.
 * @property startTimestamp - Pass start time (epoch ms).
 * @property endTimestamp - Pass end time (epoch ms).
 */
export interface SatellitePass {
  satName: string
  startTimestamp: number
  endTimestamp: number
}

/**
 * Build a stable, unique key for a satellite. Uses the NORAD id when
 * available to avoid collisions on duplicate names.
 *
 * @param sat - Satellite to identify.
 * @returns Deterministic string key.
 */
export const getSatelliteKey = (sat: TleSatellite): string =>
  `${sat.noradId ?? 'no-norad'}-${sat.name}`
