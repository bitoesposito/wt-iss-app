/**
 * Shared satellite utilities used by the `satellite-map` and
 * `satellite-orbit-tracker` widgets. Exposes a single barrel so every
 * consumer resolves to the same webpack chunk via
 * `widgets/shared-code/satellite-core`.
 */

export type {
  TleSatellite,
  SatellitePass,
} from './lib/satellite-core/types'
export { getSatelliteKey } from './lib/satellite-core/types'

export type { ComputeSatellitePointOptions } from './lib/satellite-core/tle'
export {
  computeSatellitePoint,
  getCachedSatrec,
  haversineKm,
} from './lib/satellite-core/tle'

export type { SelectionListener } from './lib/satellite-core/channel'
export {
  normalizeChannelId,
  publishSelection,
  subscribeSelection,
} from './lib/satellite-core/channel'

export type { FetchJsonOptions } from './lib/satellite-core/fetch'
export { fetchJsonWithTimeout } from './lib/satellite-core/fetch'

export {
  readCalciteStringValue,
  readCalciteNumberValue,
  readCalciteCheckedValue,
} from './lib/satellite-core/calcite-events'
