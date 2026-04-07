export interface Position {
  id: number;
  latitude: number;
  longitude: number;
  date: Date;
}

export interface IssResponse {
  iss_position: {
    latitude: string
    longitude: string
  }
  message: 'success' | string
  timestamp: number
}

export interface IssPosition {
  latitude: number
  longitude: number
  timestamp: number
}