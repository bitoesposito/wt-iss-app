import '@arcgis/map-components/components/arcgis-map'
import '@arcgis/map-components/components/arcgis-scene'
import '@arcgis/map-components/components/arcgis-expand'

import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from '../../store'
import {
  clearActiveIssPositionKey,
  setActiveIssPositionKey,
  toggleIssDimension,
} from '../../store/iss-slice'
import { clearActiveSatelliteKey } from '../../store/satellite-slice'

import useIssGraphicLayer from '../../hooks/use-iss-graphic'
import useIssSceneGraphic from '../../hooks/use-iss-scene-graphic.ts'
import useIssOrbitTrack from '../../hooks/use-iss-orbit-track'
import useSatGraphicLayer from '../../hooks/use-sat-graphic'
import SatelliteOrbitTrackerComponent from '../widgets/SatelliteOrbitTracker'
import MapViewControls from './MapViewControls'

type ViewpointLike = {
  clone: () => ViewpointLike
  targetGeometry: { latitude: number }
  scale: number
}

type ViewElementWithViewpoint = HTMLElement & {
  viewpoint?: ViewpointLike
}

const syncViewpoint = (
  from: HTMLElement | null,
  to: HTMLElement | null,
  direction: '2d-to-3d' | '3d-to-2d',
) => {
  if (!from || !to) return

  const source = from as ViewElementWithViewpoint
  const target = to as ViewElementWithViewpoint

  const viewpoint = source.viewpoint?.clone()
  if (!viewpoint) return

  const latitude = viewpoint.targetGeometry?.latitude ?? 0
  const scaleConversionFactor = Math.cos((latitude * Math.PI) / 180)

  if (direction === '2d-to-3d') viewpoint.scale *= scaleConversionFactor
  else viewpoint.scale /= scaleConversionFactor

  target.viewpoint = viewpoint
}

export default function MapComponent() {
  const dispatch = useDispatch<AppDispatch>()
  const mapElementRef = useRef<HTMLElement | null>(null)
  const issSceneElementRef = useRef<HTMLElement | null>(null)
  const satSceneElementRef = useRef<HTMLElement | null>(null)

  const viewMode = useSelector((state: RootState) => state.viewMode.viewMode)
  const issDimension = useSelector(
    (state: RootState) => state.iss.issDimension,
  )
  const issPositions = useSelector((state: RootState) => state.iss.positions)
  const issTle = useSelector((state: RootState) => state.iss.tle)
  const follow = useSelector((state: RootState) => state.iss.follow)
  const activeIssPositionKey = useSelector(
    (state: RootState) => state.iss.activeIssPositionKey,
  )
  const selectedSatellites = useSelector(
    (state: RootState) => state.satellites.selected,
  )
  const activeSatelliteKey = useSelector(
    (state: RootState) => state.satellites.activeSatelliteKey,
  )

  const isIssMode = viewMode === 'iss'
  const is3D = issDimension === '3d'

  const handleSelectIssPositionKey = useCallback(
    (key: string | null) => {
      dispatch(setActiveIssPositionKey(key))
    },
    [dispatch],
  )

  const handleToggleDimension = useCallback(() => {
    const direction = is3D ? '3d-to-2d' : '2d-to-3d'
    const from = is3D ? issSceneElementRef.current : mapElementRef.current
    const to = is3D ? mapElementRef.current : issSceneElementRef.current

    syncViewpoint(from, to, direction)
    dispatch(toggleIssDimension())
  }, [dispatch, is3D])

  useEffect(() => {
    if (isIssMode) return
    dispatch(clearActiveIssPositionKey())
  }, [dispatch, isIssMode])

  useEffect(() => {
    if (!isIssMode) return
    dispatch(clearActiveSatelliteKey())
  }, [dispatch, isIssMode])

  useIssGraphicLayer({
    mapElement: isIssMode && !is3D ? mapElementRef.current : null,
    positions: issPositions,
    activeIssPositionKey,
    follow,
    onSelectIssPositionKey: handleSelectIssPositionKey,
  })

  useIssSceneGraphic({
    sceneElement: isIssMode && is3D ? issSceneElementRef.current : null,
    positions: issPositions,
    activeIssPositionKey,
    follow,
  })

  useIssOrbitTrack({
    mapElement: isIssMode && !is3D ? mapElementRef.current : null,
    tle: issTle,
    withAltitude: false,
  })

  useIssOrbitTrack({
    mapElement: isIssMode && is3D ? issSceneElementRef.current : null,
    tle: issTle,
    withAltitude: true,
  })

  useSatGraphicLayer({
    mapElement: !isIssMode ? satSceneElementRef.current : null,
    positions: selectedSatellites,
    activeSatelliteKey,
  })

  return (
    <div className='relative w-full h-full'>
      {isIssMode ? (
        <>
          <arcgis-map
            ref={(element: HTMLElement | null) => {
              mapElementRef.current = element
            }}
            basemap='dark-gray-vector'
            className={`iss-overlay-view ${!is3D ? 'visible' : ''}`}
          ></arcgis-map>
          <arcgis-scene
            ref={(element: HTMLElement | null) => {
              issSceneElementRef.current = element
            }}
            basemap='dark-gray-vector'
            className={`iss-overlay-view ${is3D ? 'visible' : ''}`}
          >
            <MapViewControls />
          </arcgis-scene>
          <div className='absolute top-4 right-4 z-10'>
            <calcite-segmented-control
              aria-label='Dimensione vista'
              scale='s'
              oncalciteSegmentedControlChange={(event: CustomEvent) => {
                const value = (event.target as unknown as { value?: string })
                  .value
                if ((value === '3d') !== is3D) handleToggleDimension()
              }}
            >
              <calcite-segmented-control-item value='2d' checked={!is3D}>
                2D
              </calcite-segmented-control-item>
              <calcite-segmented-control-item value='3d' checked={is3D}>
                3D
              </calcite-segmented-control-item>
            </calcite-segmented-control>
          </div>
        </>
      ) : (
        <arcgis-scene
          ref={(element: HTMLElement | null) => {
            satSceneElementRef.current = element
          }}
          basemap='dark-gray-vector'
          className='absolute inset-0'
        >
          <MapViewControls />
          <arcgis-expand
            className='pb-3'
            slot='top-right'
            mode='drawer'
            expandIcon='sky-plot'
          >
            <SatelliteOrbitTrackerComponent />
          </arcgis-expand>
        </arcgis-scene>
      )}
    </div>
  )
}
