export type ViewMode = "iss" | "satellite";

export type IssDimension = '2d' | '3d'

export type IssPosition = {
    latitude: number;
    longitude: number;
    altitude?: number;
    velocity?: number;
    timestamp: number;
}

export type OrbitalParams = {
  apoapsis: number
  periapsis: number
  inclination: number
  eccentricity: number
  period: number
  revolutionNumber: number
  betaAngle: number
  altitude?: number
  speedKmH?: number
  isInSunlight?: boolean
  sunriseIn?: number | null
  sunsetIn?: number | null
}

export type IssTle = {
  line1: string
  line2: string
}

export type IssState = {
  positions: IssPosition[]
  activeIssPositionKey: string | null
  issDimension: IssDimension
  follow: boolean
  orbital: OrbitalParams | null
  tle: IssTle | null
}

export type TleSatellite = {
  name: string;
  line1: string;
  line2: string;
  noradId: number | null;
};

export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error'

export type SatelliteState = {
  positions: TleSatellite[]
  selected: TleSatellite[]
  activeSatelliteKey: string | null
  status: AsyncStatus
  error: string | null
}

export * from './arcgis-map'
