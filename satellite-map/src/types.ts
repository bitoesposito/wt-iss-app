export interface TleSatellite {
  name: string
  line1: string
  line2: string
  noradId: number | null
}

export const getSatelliteKey = (sat: TleSatellite): string => {
  return `${sat.noradId ?? 'no-norad'}-${sat.name}`
}
