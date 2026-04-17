import Point from 'esri/geometry/Point'
import * as satellite from 'satellite.js'
import type { EciVec3 } from 'satellite.js'

import type { TleSatellite } from './types'
import { getSatelliteKey } from './types'

/**
 * WGS84 spatial reference descriptor used by all `Point` constructions.
 * Declared as a plain object to keep the module free of side-effects at
 * import time.
 */
const WGS84 = { wkid: 4326 } as const

/**
 * Parse a TLE set to a `satrec` propagation object.
 * Returns `null` when the TLE is malformed so callers can skip it safely.
 *
 * @param line1 - First line of the TLE set.
 * @param line2 - Second line of the TLE set.
 */
const safeTwoLineToSatrec = (
  line1: string,
  line2: string,
): ReturnType<typeof satellite.twoline2satrec> | null => {
  try {
    return satellite.twoline2satrec(line1, line2)
  } catch {
    return null
  }
}

/**
 * Small LRU-free cache keyed by satellite identity. TLE sets for a given
 * satellite rarely change within a session, so memoizing avoids reparsing
 * the same strings for every propagation step.
 */
const satrecCache = new Map<string, ReturnType<typeof satellite.twoline2satrec>>()

/**
 * Lookup or build a cached `satrec` for the given satellite.
 *
 * @param sat - Satellite to propagate.
 * @returns Propagation record, or `null` when the TLE is invalid.
 */
export const getCachedSatrec = (
  sat: TleSatellite,
): ReturnType<typeof satellite.twoline2satrec> | null => {
  const key = `${getSatelliteKey(sat)}::${sat.line1}::${sat.line2}`
  const cached = satrecCache.get(key)
  if (cached) return cached

  const satrec = safeTwoLineToSatrec(sat.line1, sat.line2)
  if (satrec) satrecCache.set(key, satrec)
  return satrec
}

/**
 * Options for {@link computeSatellitePoint}.
 *
 * @property includeAltitude - When `true` the returned point carries the
 *   satellite altitude (in meters) as `z`. When `false` the point is pinned
 *   to the ground (`z = 0`), which is what ground-track calculations want.
 */
export interface ComputeSatellitePointOptions {
  includeAltitude?: boolean
}

/**
 * Propagate a satellite to a given date and return the sub-satellite (or
 * full 3D) position as an ArcGIS `Point` in WGS84.
 *
 * Returns `null` when the TLE cannot be parsed, the propagation step fails,
 * or the resulting coordinates are not finite numbers. All callers are
 * expected to handle `null` as "skip this sample".
 *
 * @param sat - Satellite descriptor holding the TLE set.
 * @param date - Instant at which the position must be computed.
 * @param options - Optional flags to customize the output point.
 */
export const computeSatellitePoint = (
  sat: TleSatellite,
  date: Date,
  options: ComputeSatellitePointOptions = {},
): Point | null => {
  const { includeAltitude = false } = options

  const satrec = getCachedSatrec(sat)
  if (!satrec) return null

  const positionAndVelocity = satellite.propagate(satrec, date)
  if (!positionAndVelocity) return null

  const positionEci = positionAndVelocity.position as EciVec3<number> | undefined
  if (
    !positionEci ||
    typeof positionEci.x !== 'number' ||
    typeof positionEci.y !== 'number' ||
    typeof positionEci.z !== 'number'
  ) {
    return null
  }

  const gmst = satellite.gstime(date)
  const positionGd = satellite.eciToGeodetic(positionEci, gmst)

  const longitude = satellite.degreesLong(positionGd.longitude)
  const latitude = satellite.degreesLat(positionGd.latitude)
  const altitudeMeters = positionGd.height * 1000

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    (includeAltitude && !Number.isFinite(altitudeMeters))
  ) {
    return null
  }

  return new Point({
    longitude,
    latitude,
    z: includeAltitude ? altitudeMeters : 0,
    spatialReference: WGS84,
  })
}

/**
 * Haversine distance in kilometers between two geographic coordinates.
 * Used as a fast first-pass check before paying for geodesic buffers.
 *
 * @param lon1 - Longitude of the first point in degrees.
 * @param lat1 - Latitude of the first point in degrees.
 * @param lon2 - Longitude of the second point in degrees.
 * @param lat2 - Latitude of the second point in degrees.
 */
export const haversineKm = (
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number => {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
