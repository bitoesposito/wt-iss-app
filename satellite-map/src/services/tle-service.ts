import {
  fetchJsonWithTimeout,
  type TleSatellite,
} from 'widgets/shared-code/satellite-core'

/**
 * Thirty minutes in milliseconds. TLE sets drift slowly enough that a
 * half-hour cache is safe in exchange for avoiding heavy downloads when
 * users toggle between sessions or widgets.
 */
const CACHE_TTL_MS = 30 * 60 * 1000

/**
 * Maximum number of satellites cached in `localStorage`. Protects against
 * quota exceptions on TLE feeds that include tens of thousands of entries.
 */
const CACHE_MAX_ENTRIES = 5000

interface TleApiMember {
  satelliteId?: number
  name: string
  line1: string
  line2: string
}

interface TleApiResponse {
  member?: TleApiMember[]
}

interface CacheEntry {
  data: TleSatellite[]
  timestamp: number
}

/**
 * Build a deterministic cache key for a given TLE endpoint. Encoded via
 * `encodeURIComponent` so arbitrary user input cannot inject delimiters.
 */
const getCacheKey = (url: string): string =>
  `satellite-tle-cache::${encodeURIComponent(url)}`

/**
 * Read a cached TLE response, transparently dropping stale entries.
 * Returns `null` on miss, expiry, or when parsing fails so callers can
 * fall through to a network fetch.
 */
const readCache = (url: string): TleSatellite[] | null => {
  try {
    const raw = window.localStorage.getItem(getCacheKey(url))
    if (!raw) return null

    const entry = JSON.parse(raw) as CacheEntry
    if (!entry || typeof entry.timestamp !== 'number') return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      window.localStorage.removeItem(getCacheKey(url))
      return null
    }
    if (!Array.isArray(entry.data)) return null
    return entry.data
  } catch {
    return null
  }
}

/**
 * Persist a TLE response in `localStorage` with a timestamp. Failures
 * (quota exceeded, private mode, disabled storage) are swallowed so the
 * widget can still render even when caching is unavailable.
 */
const writeCache = (url: string, data: TleSatellite[]): void => {
  if (data.length > CACHE_MAX_ENTRIES) return
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() }
    window.localStorage.setItem(getCacheKey(url), JSON.stringify(entry))
  } catch {
    // Quota exceeded or storage disabled: silent fallthrough.
  }
}

/**
 * Deduplicates in-flight requests so two widgets sharing a URL do not
 * hit the network twice. Keyed by the raw URL since different endpoints
 * may legitimately need parallel fetches.
 */
const inFlightRequests = new Map<string, Promise<TleSatellite[]>>()

const mapApiMemberToSatellite = (m: TleApiMember): TleSatellite => ({
  name: m.name,
  line1: m.line1,
  line2: m.line2,
  noradId: typeof m.satelliteId === 'number' ? m.satelliteId : null,
})

/**
 * Fetch TLE data from the given URL, honoring cache, in-flight
 * deduplication, and optional cancellation.
 *
 * @param url - Absolute URL of a TLE endpoint returning `{ member: [...] }`.
 * @param signal - Optional `AbortSignal` to cancel the request early.
 * @returns Array of satellites parsed from the endpoint.
 */
export const fetchSatellitesTle = async (
  url: string,
  signal?: AbortSignal,
): Promise<TleSatellite[]> => {
  const cached = readCache(url)
  if (cached) return cached

  const existing = inFlightRequests.get(url)
  if (existing) return existing

  const request = (async () => {
    const json = await fetchJsonWithTimeout<TleApiResponse>(url, { signal })
    const satellites = (json.member ?? [])
      .filter((m) => m && typeof m.name === 'string' && typeof m.line1 === 'string' && typeof m.line2 === 'string')
      .map(mapApiMemberToSatellite)
    writeCache(url, satellites)
    return satellites
  })()

  inFlightRequests.set(url, request)
  try {
    return await request
  } finally {
    inFlightRequests.delete(url)
  }
}
