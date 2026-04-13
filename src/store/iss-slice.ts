import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { IssDimension, IssPosition, IssState } from '../types'

const MAX_ISS_POSITIONS = 40

const initialState: IssState = {
  positions: [],
  activeIssPositionKey: null,
  issDimension: '2d',
}

export const issSlice = createSlice({
  name: 'iss',
  initialState,
  reducers: {
    addIssPosition: (state, action: PayloadAction<IssPosition>) => {
      const alreadyExists = state.positions.some((item) => {
        return (
          item.timestamp === action.payload.timestamp &&
          item.latitude === action.payload.latitude &&
          item.longitude === action.payload.longitude
        )
      })

      if (alreadyExists) return

      state.positions.unshift(action.payload)
      if (state.positions.length > MAX_ISS_POSITIONS) {
        state.positions.pop()
      }
    },
    setActiveIssPositionKey: (state, action: PayloadAction<string | null>) => {
      state.activeIssPositionKey = action.payload
    },
    clearActiveIssPositionKey: (state) => {
      state.activeIssPositionKey = null
    },
    setIssDimension: (state, action: PayloadAction<IssDimension>) => {
      state.issDimension = action.payload
    },
    toggleIssDimension: (state) => {
      state.issDimension = state.issDimension === '2d' ? '3d' : '2d'
    },
  },
})

export const {
  addIssPosition,
  setActiveIssPositionKey,
  clearActiveIssPositionKey,
  setIssDimension,
  toggleIssDimension,
} = issSlice.actions
export default issSlice.reducer