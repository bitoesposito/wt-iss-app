import type { ImmutableObject } from 'seamless-immutable'

export interface Config {
  fetchUrl: string
  refreshInterval: number
  maxPositionCount: number
  sceneWidgetId: string
}

export type IMConfig = ImmutableObject<Config>
