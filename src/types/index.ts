export type ViewMode = "iss" | "satellite";

export type IssPosition = {
    latitude: number;
    longitude: number;
    timestamp: number;
}

export type IssState = {
  positions: IssPosition[]
  activeIssPositionKey: string | null
}

export type TleSatellite = {
  name: string;
  line1: string;
  line2: string;
  noradId: number | null;
};

export type SatelliteState = {
  positions: TleSatellite[]
  selected: TleSatellite[]
}

export * from './arcgis-map'