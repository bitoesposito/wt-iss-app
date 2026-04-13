import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from '../../store'
import { setActiveIssPositionKey } from '../../store/iss-slice'
import { getIssKey } from '../../lib/iss-utils'

export default function IssMenu() {
  const dispatch = useDispatch<AppDispatch>()
  const positions = useSelector((state: RootState) => state.iss.positions)

  const handleHover = useCallback(
    (key: string | null) => {
      dispatch(setActiveIssPositionKey(key))
    },
    [dispatch],
  )

  return (
    <calcite-list-item-group
      heading='MAPPA ISS'
      className='relative h-full min-h-0 overflow-hidden lg:h-full'
    >
      <div className='absolute right-0 top-[1rem] flex gap-2 px-3'>
        <calcite-icon icon='refresh' scale='s'></calcite-icon>
        <calcite-label scale='s'>10 sec</calcite-label>
      </div>
      <div className='flex h-full min-h-0 flex-col'>
        <hr className='mx-3 mb-3 shrink-0' />
        <main className='flex min-h-0 flex-1 flex-col overflow-y-auto md:max-h-[calc(100vh-6.8rem)]'>
          {positions.map((position) => {
            const key = getIssKey(position)

            return (
              <calcite-action
                key={key}
                id={`iss-${key}`}
                icon='pin'
                text-enabled
                text={`${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`}
                scale='m'
                onPointerEnter={() => handleHover(key)}
                onPointerLeave={() => handleHover(null)}
                onFocus={() => handleHover(key)}
                onBlur={() => handleHover(null)}
              ></calcite-action>
            )
          })}
        </main>
      </div>
    </calcite-list-item-group>
  )
}
