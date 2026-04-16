export interface TleSatellite {
  name: string
  line1: string
  line2: string
  noradId: number | null
}

export interface SatellitePass {
  satName: string
  startTimestamp: number
  endTimestamp: number
}
