import { useEffect, useRef, useState } from 'react'
import type { JimuMapView } from 'jimu-arcgis'

import GraphicsLayer from 'esri/layers/GraphicsLayer'
import Graphic from 'esri/Graphic'
import Point from 'esri/geometry/Point'
import Polyline from 'esri/geometry/Polyline'
import SimpleMarkerSymbol from 'esri/symbols/SimpleMarkerSymbol'
import SimpleLineSymbol from 'esri/symbols/SimpleLineSymbol'
import * as satellite from 'satellite.js'
import type { EciVec3 } from 'satellite.js'

import type { TleSatellite } from '../types'
import { getSatelliteKey } from '../types'

type UseSatGraphicLayerParams = {
  jimuMapView: JimuMapView | null
  selectedSatellites: TleSatellite[]
  activeSatelliteKey: string | null
  tick: number
}

const POSITIONS_LAYER_ID = 'satellite-positions'
const TRACKS_LAYER_ID = 'satellite-tracks'
const TRACK_WINDOW_MINUTES = 90
const TRACK_STEP_SECONDS = 120

const positionSymbol = new SimpleMarkerSymbol({
  style: 'circle',
  color: [59, 130, 246, 0.85],
  size: 8,
  outline: { color: [255, 255, 255, 0.9], width: 1 },
})

const trackSymbol = new SimpleLineSymbol({
  color: [59, 130, 246, 0.33],
  width: 1.5,
})

const getSatellitePointFromTle = (
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
    typeof positionGd.latitude !== 'number' ||
    typeof positionGd.height !== 'number'
  ) {
    return null
  }

  const longitude = satellite.degreesLong(positionGd.longitude)
  const latitude = satellite.degreesLat(positionGd.latitude)
  const altitudeMeters = positionGd.height * 1000

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(altitudeMeters)
  ) {
    return null
  }

  return new Point({
    longitude,
    latitude,
    z: altitudeMeters,
    spatialReference: { wkid: 4326 },
  })
}

export default function useSatGraphicLayer({
  jimuMapView,
  selectedSatellites,
  activeSatelliteKey,
  tick,
}: UseSatGraphicLayerParams) {
  const positionsLayerRef = useRef<GraphicsLayer | null>(null)
  const tracksLayerRef = useRef<GraphicsLayer | null>(null)
  const [layersReady, setLayersReady] = useState(false)

  useEffect(() => {
    if (!jimuMapView) return

    let cancelled = false

    jimuMapView.whenJimuMapViewLoaded().then(() => {
      if (cancelled) return

      const map = jimuMapView.view.map

      const existingPos = map.findLayerById(POSITIONS_LAYER_ID)
      const existingTrk = map.findLayerById(TRACKS_LAYER_ID)
      if (existingPos) map.remove(existingPos)
      if (existingTrk) map.remove(existingTrk)

      const tracksLayer = new GraphicsLayer({ id: TRACKS_LAYER_ID })
      const positionsLayer = new GraphicsLayer({ id: POSITIONS_LAYER_ID })

      map.add(tracksLayer)
      map.add(positionsLayer)

      tracksLayerRef.current = tracksLayer
      positionsLayerRef.current = positionsLayer
      setLayersReady(true)
    })

    return () => {
      cancelled = true

      const map = jimuMapView?.view?.map
      if (map) {
        if (positionsLayerRef.current) map.remove(positionsLayerRef.current)
        if (tracksLayerRef.current) map.remove(tracksLayerRef.current)
      }

      positionsLayerRef.current = null
      tracksLayerRef.current = null
      setLayersReady(false)
    }
  }, [jimuMapView])

  useEffect(() => {
    if (!layersReady) return
    const layer = positionsLayerRef.current
    if (!layer) return

    layer.removeAll()

    const now = new Date()

    for (const sat of selectedSatellites) {
      const point = getSatellitePointFromTle(sat.line1, sat.line2, now)
      if (!point) continue

      layer.add(
        new Graphic({
          geometry: point,
          symbol: positionSymbol,
          attributes: {
            name: sat.name,
            noradId: sat.noradId,
            longitude: Number(point.longitude?.toFixed(6)),
            latitude: Number(point.latitude?.toFixed(6)),
            altitudeKm: Math.round(((point.z ?? 0) / 1000) * 100) / 100,
          },
          popupTemplate: {
            title: '{name}',
            content:
              'NORAD: <b>{noradId}</b><br/>' +
              'Lon: <b>{longitude}</b>, Lat: <b>{latitude}</b><br/>' +
              'Alt: <b>{altitudeKm} km</b>',
          } as __esri.PopupTemplateProperties,
        })
      )
    }
  }, [selectedSatellites, layersReady, tick])

  useEffect(() => {
    if (!layersReady) return
    const layer = tracksLayerRef.current
    if (!layer) return

    layer.removeAll()

    const now = Date.now()

    for (const sat of selectedSatellites) {
      const points: number[][] = []

      for (
        let s = 0;
        s <= TRACK_WINDOW_MINUTES * 60;
        s += TRACK_STEP_SECONDS
      ) {
        const point = getSatellitePointFromTle(
          sat.line1,
          sat.line2,
          new Date(now + s * 1000)
        )
        if (!point) continue

        const lon = point.longitude
        const lat = point.latitude
        const z = point.z ?? 0

        if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(z)) {
          continue
        }

        points.push([lon, lat, z])
      }

      if (points.length < 2) continue

      layer.add(
        new Graphic({
          geometry: new Polyline({
            paths: [points],
            spatialReference: { wkid: 4326 },
          }),
          symbol: trackSymbol,
          attributes: { name: sat.name, noradId: sat.noradId },
        })
      )
    }
  }, [selectedSatellites, layersReady, tick])

  useEffect(() => {
    if (!jimuMapView?.view || !activeSatelliteKey) return

    const sat = selectedSatellites.find(
      (s) => getSatelliteKey(s) === activeSatelliteKey
    )
    if (!sat) return

    const point = getSatellitePointFromTle(sat.line1, sat.line2, new Date())
    if (!point) return

    jimuMapView.view.goTo({ center: point, zoom: 4 }).catch(() => {})
  }, [activeSatelliteKey, jimuMapView, selectedSatellites])
}
