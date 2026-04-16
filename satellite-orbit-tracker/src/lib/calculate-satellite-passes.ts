import Point from 'esri/geometry/Point'
import SpatialReference from 'esri/geometry/SpatialReference'
import type Geometry from 'esri/geometry/Geometry'
import * as geometryEngine from 'esri/geometry/geometryEngine'
import * as satellite from 'satellite.js'
import type { EciVec3 } from 'satellite.js'

import type { TleSatellite, SatellitePass } from '../types'

type CalculateSatellitePassesParams = {
  satellites: TleSatellite[]
  start: Date
  end: Date
  stepMs: number
  aoiGeometry: Geometry
  aoiBufferKm?: number
  satelliteBufferKm?: number
  maxSteps?: number
}

const getGroundPointFromTle = (
  line1: string,
  line2: string,
  date: Date
): Point | null => {
  let satrec: ReturnType<typeof satellite.twoline2satrec>
  try {
    satrec = satellite.twoline2satrec(line1, line2)
  } catch {
    return null
  }

  const positionAndVelocity = satellite.propagate(satrec, date)
  if (!positionAndVelocity) return null

  const positionEci = positionAndVelocity.position
  if (
    !positionEci ||
    typeof (positionEci as EciVec3<number>).x !== 'number' ||
    typeof (positionEci as EciVec3<number>).y !== 'number' ||
    typeof (positionEci as EciVec3<number>).z !== 'number'
  ) {
    return null
  }

  const gmst = satellite.gstime(date)
  const positionGd = satellite.eciToGeodetic(positionEci as EciVec3<number>, gmst)

  if (
    typeof positionGd.longitude !== 'number' ||
    typeof positionGd.latitude !== 'number'
  ) {
    return null
  }

  const longitude = satellite.degreesLong(positionGd.longitude)
  const latitude = satellite.degreesLat(positionGd.latitude)

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

  return new Point({
    longitude,
    latitude,
    z: 0,
    spatialReference: SpatialReference.WGS84,
  })
}

const ensureWgs84 = (geometry: Geometry): Geometry => {
  const sr = geometry.spatialReference
  if (!sr || sr.wkid === 4326 || sr.isWGS84) return geometry

  if (sr.wkid === 102100 || sr.wkid === 3857) {
    if (geometry.type === 'point') {
      const pt = geometry as __esri.Point
      return new Point({
        longitude: pt.longitude,
        latitude: pt.latitude,
        z: pt.z,
        spatialReference: SpatialReference.WGS84,
      })
    }
  }

  return geometry
}

export const calculateSatellitePasses = async (
  params: CalculateSatellitePassesParams
): Promise<SatellitePass[]> => {
  const {
    satellites,
    start,
    end,
    stepMs,
    aoiGeometry,
    aoiBufferKm,
    satelliteBufferKm = 50,
    maxSteps = 10_000,
  } = params

  const startMs = start.getTime()
  const endMs = end.getTime()

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return []
  if (endMs <= startMs) return []
  if (!Number.isFinite(stepMs) || stepMs <= 0) return []

  const steps = Math.ceil((endMs - startMs) / stepMs)
  if (steps > maxSteps) {
    throw new Error(
      `Range too large: ${steps} steps (max ${maxSteps}). Reduce the range or increase the step.`
    )
  }

  let aoi = ensureWgs84(aoiGeometry)

  if (typeof aoiBufferKm === 'number' && Number.isFinite(aoiBufferKm) && aoiBufferKm > 0) {
    aoi = geometryEngine.geodesicBuffer(
      aoi as __esri.Geometry,
      aoiBufferKm,
      'kilometers'
    ) as unknown as Geometry
  }

  const passes: SatellitePass[] = []

  for (const sat of satellites) {
    let currentStart: number | null = null
    let lastHit: number | null = null

    for (let t = startMs; t <= endMs; t += stepMs) {
      const groundPoint = getGroundPointFromTle(sat.line1, sat.line2, new Date(t))
      if (!groundPoint) continue

      const satArea = geometryEngine.geodesicBuffer(
        groundPoint as __esri.Geometry,
        satelliteBufferKm,
        'kilometers'
      )

      const hit = geometryEngine.intersects(
        satArea as __esri.Geometry,
        aoi as __esri.Geometry
      )

      if (hit) {
        if (currentStart === null) currentStart = t
        lastHit = t
        continue
      }

      if (currentStart !== null && lastHit !== null) {
        passes.push({
          satName: sat.name,
          startTimestamp: currentStart,
          endTimestamp: lastHit,
        })
      }

      currentStart = null
      lastHit = null
    }

    if (currentStart !== null && lastHit !== null) {
      passes.push({
        satName: sat.name,
        startTimestamp: currentStart,
        endTimestamp: lastHit,
      })
    }
  }

  passes.sort((a, b) => a.startTimestamp - b.startTimestamp)
  return passes
}
