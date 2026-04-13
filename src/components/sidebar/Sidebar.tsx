import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from '../../store'
import NavbarComponent from '../navbar/Navbar'
import IssMenu from './IssMenu'
import SatelliteMenu from './SatelliteMenu'

export default function SidebarComponent() {
  const dispatch = useDispatch<AppDispatch>()
  const viewMode = useSelector((state: RootState) => state.viewMode.viewMode)
  const satellitePositions = useSelector(
    (state: RootState) => state.satellites.positions,
  )
  const selectedSatellites = useSelector(
    (state: RootState) => state.satellites.selected,
  )
  return (
    <calcite-shell-panel slot='panel-start'>
      <NavbarComponent />
      <calcite-panel width='320px' className='overflow-hidden'>
        <calcite-list label='View mode' className='overflow-hidden'>
          {viewMode === 'iss' ? (
            <IssMenu />
          ) : (
            <SatelliteMenu
              satellitePositions={satellitePositions}
              selectedSatellites={selectedSatellites}
              dispatch={dispatch}
            />
          )}
        </calcite-list>
      </calcite-panel>
    </calcite-shell-panel>
  )
}