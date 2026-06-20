import { useEffect, useRef } from 'react'

import Graphic from '@arcgis/core/Graphic'
import Polyline from '@arcgis/core/geometry/Polyline'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import SpatialReference from '@arcgis/core/geometry/SpatialReference'

import type { IssTle } from '../types'
import { getArcgisMapFromElement } from '../types/arcgis-map'
import { propagateTleToGeodetic } from '../lib/satellite/propagate'
import { ACTIVE_BLUE } from '../lib/map-style'

type UseIssOrbitTrackParams = {
  mapElement: HTMLElement | null
  tle: IssTle | null
  withAltitude: boolean
}

const STEP_SECONDS = 60
const ORBIT_PERIOD_MINUTES = 93

// Disegna la traiettoria orbitale della ISS (un'orbita completa in avanti).
// `withAltitude`: true per la scene 3D (z = altitudine), false per la mappa 2D.
export default function useIssOrbitTrack({
  mapElement,
  tle,
  withAltitude,
}: UseIssOrbitTrackParams) {
  const layerRef = useRef<GraphicsLayer | null>(null)

  useEffect(() => {
    if (!mapElement || !tle) return

    let cancelled = false

    const run = async () => {
      while (!cancelled && !getArcgisMapFromElement(mapElement)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (cancelled) return

      const map = getArcgisMapFromElement(mapElement)
      if (!map) return

      const layer = new GraphicsLayer({ id: 'iss-orbit-track' })
      if (withAltitude) {
        ;(layer as unknown as { elevationInfo: unknown }).elevationInfo = {
          mode: 'absolute-height',
        }
      }
      map.layers.add(layer as unknown)
      layerRef.current = layer

      // Spezza la polilinea quando attraversa l'antimeridiano (Δlon > 180)
      // per evitare segmenti orizzontali spuri sulla mappa 2D.
      const now = Date.now()
      const totalSeconds = ORBIT_PERIOD_MINUTES * 60
      const paths: number[][][] = []
      let current: number[][] = []
      let prevLon: number | null = null

      for (let s = 0; s <= totalSeconds; s += STEP_SECONDS) {
        const geo = propagateTleToGeodetic({
          line1: tle.line1,
          line2: tle.line2,
          date: new Date(now + s * 1000),
        })
        if (!geo) continue

        const z = withAltitude ? geo.altitudeMeters : 0
        if (prevLon !== null && Math.abs(geo.longitude - prevLon) > 180) {
          if (current.length > 1) paths.push(current)
          current = []
        }
        current.push([geo.longitude, geo.latitude, z])
        prevLon = geo.longitude
      }
      if (current.length > 1) paths.push(current)
      if (paths.length === 0) return

      layer.add(
        new Graphic({
          geometry: new Polyline({
            paths,
            spatialReference: SpatialReference.WGS84,
          }),
          symbol: {
            type: 'simple-line',
            color: [ACTIVE_BLUE[0], ACTIVE_BLUE[1], ACTIVE_BLUE[2], 0.85],
            width: 2,
          } as const,
        }),
      )
    }

    void run()

    return () => {
      cancelled = true
      const map = getArcgisMapFromElement(mapElement)
      if (map && layerRef.current) {
        map.layers.remove(layerRef.current as unknown)
      }
      layerRef.current = null
    }
  }, [mapElement, tle, withAltitude])
}
