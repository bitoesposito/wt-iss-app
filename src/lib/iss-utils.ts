import type { IssPosition } from '../types'

export const getIssKey = (position: IssPosition) =>
  `${position.timestamp}-${position.latitude}-${position.longitude}`

