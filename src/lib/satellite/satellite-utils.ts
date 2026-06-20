import type { TleSatellite } from '../../types'

// Chiave stabile per un satellite. Unica fonte: prima duplicata in
// SatelliteMenu e use-sat-graphic.
export const getSatelliteKey = (sat: Pick<TleSatellite, 'noradId' | 'name'>) =>
  `${sat.noradId ?? 'no-norad'}-${sat.name}`
