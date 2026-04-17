import type { ImmutableObject } from 'seamless-immutable'

/**
 * User-facing configuration of the ISS Tracker widget.
 *
 * @property fetchUrl - Endpoint returning the current ISS position as JSON.
 *   Must include latitude, longitude and (optionally) altitude fields.
 * @property refreshInterval - Polling interval in milliseconds. Values
 *   below 1000 ms are clamped at runtime.
 * @property maxPositionCount - Maximum number of breadcrumb points kept
 *   on the 2D map. Older points are dropped first when the cap is hit.
 * @property sceneWidgetId - Id of the Map widget rendering a 3D scene
 *   used to place the 3D ISS model. Empty string means "no 3D scene".
 */
export interface Config {
  fetchUrl: string
  refreshInterval: number
  maxPositionCount: number
  sceneWidgetId: string
}

export type IMConfig = ImmutableObject<Config>
