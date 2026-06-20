import * as satellite from 'satellite.js'

// Risultato della propagazione di un TLE a una data: posizione geodetica.
export type GeodeticPosition = {
  longitude: number
  latitude: number
  altitudeMeters: number
}

// Propaga un TLE (line1/line2) alla data indicata e ritorna lon/lat/altitudine.
// Ritorna `null` se il TLE non è parsabile o la propagazione non è valida.
// Unica fonte: prima duplicata in use-sat-graphic e calculate-satellite-passes.
export const propagateTleToGeodetic = (params: {
  line1: string
  line2: string
  date: Date
}): GeodeticPosition | null => {
  const { line1, line2, date } = params

  let satrec: ReturnType<typeof satellite.twoline2satrec>
  try {
    satrec = satellite.twoline2satrec(line1, line2)
  } catch {
    return null
  }

  const positionAndVelocity = satellite.propagate(satrec, date)
  if (!positionAndVelocity) return null

  const positionEci = positionAndVelocity.position
  if (
    !positionEci ||
    typeof positionEci.x !== 'number' ||
    typeof positionEci.y !== 'number' ||
    typeof positionEci.z !== 'number'
  ) {
    return null
  }

  const gmst = satellite.gstime(date)
  const positionGd = satellite.eciToGeodetic(positionEci, gmst)

  if (
    typeof positionGd.longitude !== 'number' ||
    typeof positionGd.latitude !== 'number' ||
    typeof positionGd.height !== 'number'
  ) {
    return null
  }

  const longitude = satellite.degreesLong(positionGd.longitude)
  const latitude = satellite.degreesLat(positionGd.latitude)
  const altitudeMeters = positionGd.height * 1000

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(altitudeMeters)
  ) {
    return null
  }

  return { longitude, latitude, altitudeMeters }
}
