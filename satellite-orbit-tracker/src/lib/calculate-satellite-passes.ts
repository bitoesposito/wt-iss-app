import type Point from 'esri/geometry/Point'

import {
  computeSatellitePoint,
  haversineKm,
  type SatellitePass,
  type TleSatellite,
} from 'widgets/shared-code/satellite-core'

/**
 * Parameters accepted by {@link calculateSatellitePasses}.
 *
 * @property satellites - Satellites to evaluate against the AOI.
 * @property start - Inclusive start of the evaluation window.
 * @property end - Inclusive end of the evaluation window.
 * @property stepMs - Sampling interval. Smaller values increase accuracy
 *   at the cost of runtime. 60_000ms is a sensible default for LEO orbits.
 * @property aoi - Center of the area of interest as a WGS84 `Point`.
 * @property aoiBufferKm - Radius around `aoi` considered "inside". Used
 *   together with `satelliteBufferKm` to decide when a sample is a hit.
 * @property satelliteBufferKm - Footprint radius around the sub-satellite
 *   ground point. Defaults to 50 km.
 * @property maxSteps - Safety cap to prevent accidentally scheduling a
 *   calculation that would block the page for minutes. Defaults to 10000.
 * @property onProgress - Optional callback invoked between yield points.
 * @property signal - Optional `AbortSignal` to cancel early.
 */
export interface CalculateSatellitePassesParams {
  satellites: TleSatellite[]
  start: Date
  end: Date
  stepMs: number
  aoi: Point
  aoiBufferKm?: number
  satelliteBufferKm?: number
  maxSteps?: number
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

/**
 * Yield to the browser so the event loop can process input and paint
 * frames. Avoids blocking the main thread during long computations
 * without pulling in a worker.
 */
const yieldToMainThread = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Approximate window, in sampling steps, between two forced yields.
 * Tuned so even a full-range (6 days × 50 satellites) run stays
 * responsive without paying excessive scheduling overhead.
 */
const YIELD_EVERY_STEPS = 1024

/**
 * Compute the time windows during which each selected satellite flies
 * over (or near) an area of interest.
 *
 * The algorithm samples every `stepMs`, compares the great-circle
 * distance between the sub-satellite point and the AOI center against
 * the combined buffer radius, and records contiguous hit runs as passes.
 * Haversine distance is used as a first (and only) check because it is
 * orders of magnitude faster than calling `geodesicBuffer`/`intersects`
 * per sample and is accurate enough for the LEO buffers we deal with.
 *
 * @param params - See {@link CalculateSatellitePassesParams}.
 * @returns Passes sorted by start timestamp ascending.
 * @throws When the step count would exceed `maxSteps`.
 */
export const calculateSatellitePasses = async (
  params: CalculateSatellitePassesParams,
): Promise<SatellitePass[]> => {
  const {
    satellites,
    start,
    end,
    stepMs,
    aoi,
    aoiBufferKm = 0,
    satelliteBufferKm = 50,
    maxSteps = 10_000,
    onProgress,
    signal,
  } = params

  const startMs = start.getTime()
  const endMs = end.getTime()

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return []
  if (endMs <= startMs) return []
  if (!Number.isFinite(stepMs) || stepMs <= 0) return []

  const steps = Math.ceil((endMs - startMs) / stepMs)
  if (steps > maxSteps) {
    throw new Error(
      `Range too large: ${steps} steps (max ${maxSteps}). Reduce the range or increase the step.`,
    )
  }

  const aoiLon = aoi.longitude
  const aoiLat = aoi.latitude
  if (!Number.isFinite(aoiLon) || !Number.isFinite(aoiLat)) return []

  const hitRadiusKm = satelliteBufferKm + (aoiBufferKm > 0 ? aoiBufferKm : 0)
  const passes: SatellitePass[] = []
  const totalSamples = satellites.length * (steps + 1)
  let processed = 0

  for (const sat of satellites) {
    let currentStart: number | null = null
    let lastHit: number | null = null

    for (let ms = startMs; ms <= endMs; ms += stepMs) {
      if (signal?.aborted) return passes

      const groundPoint = computeSatellitePoint(sat, new Date(ms))
      let hit = false
      if (groundPoint) {
        const distanceKm = haversineKm(
          groundPoint.longitude,
          groundPoint.latitude,
          aoiLon,
          aoiLat,
        )
        hit = distanceKm <= hitRadiusKm
      }

      if (hit) {
        if (currentStart === null) currentStart = ms
        lastHit = ms
      } else if (currentStart !== null && lastHit !== null) {
        passes.push({
          satName: sat.name,
          startTimestamp: currentStart,
          endTimestamp: lastHit,
        })
        currentStart = null
        lastHit = null
      }

      processed++
      if (processed % YIELD_EVERY_STEPS === 0) {
        onProgress?.(processed / totalSamples)
        await yieldToMainThread()
      }
    }

    if (currentStart !== null && lastHit !== null) {
      passes.push({
        satName: sat.name,
        startTimestamp: currentStart,
        endTimestamp: lastHit,
      })
    }
  }

  onProgress?.(1)
  passes.sort((a, b) => a.startTimestamp - b.startTimestamp)
  return passes
}
