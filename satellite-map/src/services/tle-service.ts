import type { TleSatellite } from '../types'
import t from '../runtime/translations/default'

const CACHE_TTL_MS = 30 * 60 * 1000

interface TleApiMember {
  satelliteId: number
  name: string
  line1: string
  line2: string
}

interface TleApiResponse {
  member: TleApiMember[]
  totalItems: number
}

interface CacheEntry {
  data: TleSatellite[]
  timestamp: number
}

const getCacheKey = (url: string): string =>
  `satellite-tle-cache::${url}`

const readCache = (url: string): TleSatellite[] | null => {
  try {
    const raw = localStorage.getItem(getCacheKey(url))
    if (!raw) return null

    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(url))
      return null
    }

    return entry.data
  } catch {
    return null
  }
}

const writeCache = (url: string, data: TleSatellite[]): void => {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() }
    localStorage.setItem(getCacheKey(url), JSON.stringify(entry))
  } catch {
    // quota exceeded or unavailable — silently ignore
  }
}

const mapApiMemberToSatellite = (m: TleApiMember): TleSatellite => ({
  name: m.name,
  line1: m.line1,
  line2: m.line2,
  noradId: m.satelliteId ?? null,
})

export async function fetchSatellitesTle(
  url: string
): Promise<TleSatellite[]> {
  const cached = readCache(url)
  if (cached) return cached

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(response.status.toString()) ?? t.fetchUrlError
  }

  const json: TleApiResponse = await response.json()
  const satellites = (json.member ?? []).map(mapApiMemberToSatellite)

  writeCache(url, satellites)

  return satellites
}
