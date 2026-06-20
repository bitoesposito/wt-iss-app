import type { AppDispatch } from '../store'
import { addIssPosition, setIssOrbital } from '../store/iss-slice'

// Path relativo: in dev passa dal proxy Vite, in prod dal reverse proxy del
// dominio (vedi netlify.toml). Evita problemi di CORS verso iss.cdnspace.ca.
const ISS_STREAM_URL = '/api/telemetry/stream'

// Intervallo minimo tra due posizioni memorizzate: lo stream può emettere
// molto spesso, qui limitiamo per scia/ricentraggio fluidi.
const MIN_UPDATE_MS = 3000

type OrbitalPayload = {
  timestamp?: number
  lat?: number
  lon?: number
  altitude?: number
  velocity?: number
  speedKmH?: number
  period?: number
  inclination?: number
  eccentricity?: number
  apoapsis?: number
  periapsis?: number
  revolutionNumber?: number
  betaAngle?: number
  isInSunlight?: boolean
  sunriseIn?: number | null
  sunsetIn?: number | null
}

const num = (value: unknown): number | undefined =>
  Number.isFinite(value) ? (value as number) : undefined

/**
 * Sottoscrive lo stream SSE della telemetria ISS e aggiorna lo store a ogni
 * evento `telemetry` (campo `orbital`). Ritorna una funzione di cleanup.
 * `EventSource` riconnette in automatico in caso di errore di rete.
 */
export function subscribeIssTelemetry(dispatch: AppDispatch): () => void {
  const source = new EventSource(ISS_STREAM_URL)
  let lastIngestMs = 0

  const onTelemetry = (event: MessageEvent) => {
    const now = Date.now()
    if (now - lastIngestMs < MIN_UPDATE_MS) return

    let parsed: { orbital?: OrbitalPayload }
    try {
      parsed = JSON.parse(event.data)
    } catch {
      return
    }

    const orbital = parsed.orbital
    if (!orbital) return

    const { lat, lon, altitude, speedKmH, timestamp } = orbital
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return

    lastIngestMs = now

    dispatch(
      addIssPosition({
        latitude: lat as number,
        longitude: lon as number,
        altitude: num(altitude),
        velocity: num(speedKmH),
        timestamp: Math.floor((timestamp ?? now) / 1000),
      }),
    )

    // Parametri orbitali per il pannello (solo se presenti i campi chiave).
    if (
      Number.isFinite(orbital.apoapsis) &&
      Number.isFinite(orbital.periapsis) &&
      Number.isFinite(orbital.period)
    ) {
      dispatch(
        setIssOrbital({
          apoapsis: orbital.apoapsis as number,
          periapsis: orbital.periapsis as number,
          inclination: orbital.inclination as number,
          eccentricity: orbital.eccentricity as number,
          period: orbital.period as number,
          revolutionNumber: orbital.revolutionNumber as number,
          betaAngle: orbital.betaAngle as number,
          altitude: num(altitude),
          speedKmH: num(speedKmH),
          isInSunlight: orbital.isInSunlight,
          sunriseIn: orbital.sunriseIn,
          sunsetIn: orbital.sunsetIn,
        }),
      )
    }
  }

  source.addEventListener('telemetry', onTelemetry as EventListener)

  return () => {
    source.removeEventListener('telemetry', onTelemetry as EventListener)
    source.close()
  }
}
