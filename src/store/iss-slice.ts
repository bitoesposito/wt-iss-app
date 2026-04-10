import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { IssPosition, IssState } from '../types'

const MAX_ISS_POSITIONS = 40

const initialState: IssState = {
  positions: [],
  activeIssPositionKey: null,
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
  },
})

export const {
  addIssPosition,
  setActiveIssPositionKey,
  clearActiveIssPositionKey,
} = issSlice.actions
export default issSlice.reducer