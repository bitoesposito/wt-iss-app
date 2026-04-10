import Point from '@arcgis/core/geometry/Point'
import SpatialReference from '@arcgis/core/geometry/SpatialReference'
import type Geometry from '@arcgis/core/geometry/Geometry'
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine'
import * as projectOperator from '@arcgis/core/geometry/operators/projectOperator'
import * as satellite from 'satellite.js'

import type { TleSatellite } from '../../types'

export type SatellitePass = {
  satName: string
  startTimestamp: number
  endTimestamp: number
}

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

const getGroundPointFromTle = (params: {
  line1: string
  line2: string
  date: Date
}): Point | null => {
  const { line1, line2, date } = params

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
    typeof positionEci.x !== 'number' ||
    typeof positionEci.y !== 'number' ||
    typeof positionEci.z !== 'number'
  ) {
    return null
  }

  const gmst = satellite.gstime(date)
  const positionGd = satellite.eciToGeodetic(positionEci, gmst)

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

const toWgs84 = async (geometry: Geometry): Promise<Geometry> => {
  const sr = geometry.spatialReference
  if (sr?.wkid === 4326) return geometry

  await projectOperator.load()
  const projected = projectOperator.execute(
    geometry as unknown as never,
    SpatialReference.WGS84,
  ) as Geometry | null | undefined

  return projected ?? geometry
}

export const calculateSatellitePasses = async (
  params: CalculateSatellitePassesParams,
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
      `Intervallo troppo ampio: ${steps} step (max ${maxSteps}). Riduci l’intervallo o aumenta lo step.`,
    )
  }

  let aoi = await toWgs84(aoiGeometry)

  if (typeof aoiBufferKm === 'number' && Number.isFinite(aoiBufferKm)) {
    if (aoiBufferKm > 0) {
      aoi = geometryEngine.geodesicBuffer(
        aoi as unknown as never,
        aoiBufferKm,
        'kilometers',
      ) as unknown as Geometry
    }
  }

  const passes: SatellitePass[] = []

  for (const sat of satellites) {
    let currentStart: number | null = null
    let lastHit: number | null = null

    for (let t = startMs; t <= endMs; t += stepMs) {
      const groundPoint = getGroundPointFromTle({
        line1: sat.line1,
        line2: sat.line2,
        date: new Date(t),
      })

      if (!groundPoint) continue

      const satArea = geometryEngine.geodesicBuffer(
        groundPoint as unknown as never,
        satelliteBufferKm,
        'kilometers',
      )

      const hit = geometryEngine.intersects(
        satArea as unknown as never,
        aoi as unknown as never,
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

