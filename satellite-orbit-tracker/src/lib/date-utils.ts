/**
 * Pad a number to at least two digits with leading zeros.
 */
const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Format a `Date` as a local-ISO date string `YYYY-MM-DD`.
 * Local time is preferred over UTC because the user picks the range in
 * their own timezone, which is what the Calcite date picker shows.
 */
export const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/**
 * Format a `Date` as a local `HH:MM` time string (24-hour clock).
 */
export const toIsoTime = (d: Date): string =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/**
 * Combine a local ISO date and an `HH:MM(:SS)` time into a `Date`, or
 * return `null` when the inputs are missing or malformed.
 *
 * @param isoDate - Date component in `YYYY-MM-DD` form.
 * @param isoTime - Time component in `HH:MM` or `HH:MM:SS` form.
 */
export const combineDateAndTime = (
  isoDate: string,
  isoTime: string,
): Date | null => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(isoTime)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  const dt = new Date(`${isoDate}T${pad2(hours)}:${pad2(minutes)}:00`)
  return Number.isFinite(dt.getTime()) ? dt : null
}

/**
 * Render a human-readable duration for a satellite pass, e.g. `42s`,
 * `3m`, or `3m 15s`.
 *
 * @param startMs - Start timestamp in epoch milliseconds.
 * @param endMs - End timestamp in epoch milliseconds.
 */
export const formatDuration = (startMs: number, endMs: number): string => {
  const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000))
  if (diffSec < 60) return `${diffSec}s`
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}
