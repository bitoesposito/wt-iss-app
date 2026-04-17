import type { TleSatellite } from './types'

/**
 * Event name used on the DOM event fallback.
 * Prefixed to reduce the odds of collision with unrelated code.
 */
const DOM_EVENT_NAME = 'exb:satellite-selection-changed'

/**
 * Normalize a user-supplied channel identifier so it can be safely used as
 * a `BroadcastChannel` name. Strips characters that are not safe in
 * identifiers and enforces a maximum length.
 *
 * @param rawId - Unsanitized channel id coming from widget settings.
 * @returns A stable, conservative channel key, or `null` for empty input.
 */
export const normalizeChannelId = (rawId: string | null | undefined): string | null => {
  if (!rawId) return null
  const safe = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return safe ? `exb-satellite-${safe}` : null
}

/**
 * Payload exchanged between publisher and subscriber widgets.
 */
interface SatelliteSelectionMessage {
  channelId: string
  satellites: TleSatellite[]
}

/**
 * Minimal validator for incoming messages. Prevents a malformed or
 * unrelated event from crashing a subscriber by feeding unexpected shapes
 * into React state.
 *
 * @param value - Unknown value received over the channel or DOM event.
 * @param expectedChannelId - Normalized id the subscriber listens on.
 */
const isValidMessage = (
  value: unknown,
  expectedChannelId: string,
): value is SatelliteSelectionMessage => {
  if (!value || typeof value !== 'object') return false
  const msg = value as Partial<SatelliteSelectionMessage>
  if (msg.channelId !== expectedChannelId) return false
  if (!Array.isArray(msg.satellites)) return false
  return msg.satellites.every(
    (sat) =>
      !!sat &&
      typeof sat === 'object' &&
      typeof (sat as TleSatellite).name === 'string' &&
      typeof (sat as TleSatellite).line1 === 'string' &&
      typeof (sat as TleSatellite).line2 === 'string',
  )
}

/**
 * In-memory store of the latest payload per normalized channel id. Used
 * so late subscribers can recover the current selection without waiting
 * for the next publish call. Kept at module scope (per-bundle) and typed
 * as a readonly map outside.
 */
const lastPayloadByChannel = new Map<string, SatelliteSelectionMessage>()

/**
 * Internal factory that builds a `BroadcastChannel` lazily. Wrapped in a
 * try/catch because older browsers or sandboxed contexts may not expose
 * the constructor even when the global exists.
 */
const tryCreateBroadcastChannel = (channelId: string): BroadcastChannel | null => {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(channelId)
  } catch {
    return null
  }
}

/**
 * Publish the current satellite selection on the given channel. A
 * `BroadcastChannel` is used when available; a DOM `CustomEvent` is used
 * as fallback so the publisher and subscriber can still talk within the
 * same page even in environments where `BroadcastChannel` is missing.
 *
 * @param rawId - Raw channel id from widget settings.
 * @param satellites - Currently selected satellites to publish.
 * @returns `true` when the message was dispatched, `false` otherwise.
 */
export const publishSelection = (
  rawId: string | null | undefined,
  satellites: TleSatellite[],
): boolean => {
  const channelId = normalizeChannelId(rawId)
  if (!channelId) return false

  const message: SatelliteSelectionMessage = { channelId, satellites }
  lastPayloadByChannel.set(channelId, message)

  const bc = tryCreateBroadcastChannel(channelId)
  if (bc) {
    try {
      bc.postMessage(message)
    } finally {
      bc.close()
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DOM_EVENT_NAME, { detail: message }))
  }

  return true
}

/**
 * Subscriber callback invoked with the currently selected satellites.
 */
export type SelectionListener = (satellites: TleSatellite[]) => void

/**
 * Subscribe to satellite selection updates for the given channel. The
 * listener is invoked immediately with the last known payload when one is
 * cached, so late mounters get a consistent view without an extra publish.
 *
 * @param rawId - Raw channel id from widget settings.
 * @param listener - Callback invoked on every update.
 * @returns Unsubscribe function. Always safe to call, even multiple times.
 */
export const subscribeSelection = (
  rawId: string | null | undefined,
  listener: SelectionListener,
): (() => void) => {
  const channelId = normalizeChannelId(rawId)
  if (!channelId) return () => undefined

  const cached = lastPayloadByChannel.get(channelId)
  if (cached) listener(cached.satellites)

  const bc = tryCreateBroadcastChannel(channelId)
  const handleBroadcast = (event: MessageEvent) => {
    if (isValidMessage(event.data, channelId)) {
      lastPayloadByChannel.set(channelId, event.data)
      listener(event.data.satellites)
    }
  }
  bc?.addEventListener('message', handleBroadcast)

  const handleDomEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail
    if (isValidMessage(detail, channelId)) {
      lastPayloadByChannel.set(channelId, detail)
      listener(detail.satellites)
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(DOM_EVENT_NAME, handleDomEvent)
  }

  return () => {
    bc?.removeEventListener('message', handleBroadcast)
    bc?.close()
    if (typeof window !== 'undefined') {
      window.removeEventListener(DOM_EVENT_NAME, handleDomEvent)
    }
  }
}
