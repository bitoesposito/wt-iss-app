import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { IssPosition, IssState, IssTle, OrbitalParams } from '../types'

const MAX_ISS_POSITIONS = 40

const initialState: IssState = {
  positions: [],
  activeIssPositionKey: null,
  issDimension: '2d',
  follow: true,
  orbital: null,
  tle: null,
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
    toggleIssDimension: (state) => {
      state.issDimension = state.issDimension === '2d' ? '3d' : '2d'
    },
    setFollow: (state, action: PayloadAction<boolean>) => {
      state.follow = action.payload
    },
    toggleFollow: (state) => {
      state.follow = !state.follow
    },
    setIssOrbital: (state, action: PayloadAction<OrbitalParams>) => {
      state.orbital = action.payload
    },
    setIssTle: (state, action: PayloadAction<IssTle>) => {
      state.tle = action.payload
    },
  },
})

export const {
  addIssPosition,
  setActiveIssPositionKey,
  clearActiveIssPositionKey,
  toggleIssDimension,
  setFollow,
  toggleFollow,
  setIssOrbital,
  setIssTle,
} = issSlice.actions
export default issSlice.reducer
