/**
 * Options accepted by {@link fetchJsonWithTimeout}.
 *
 * @property signal - Optional external AbortSignal. When set, its abort
 *   event cancels the request in addition to the internal timeout.
 * @property timeoutMs - Request timeout in milliseconds. Defaults to 15s.
 */
export interface FetchJsonOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

/**
 * Perform a `fetch` call that rejects on non-2xx responses, enforces a
 * timeout, and honors an optional caller-provided abort signal.
 *
 * Non-2xx responses raise an `Error` carrying the HTTP status so callers
 * can localize the message. Network failures, timeouts, and external
 * aborts surface as plain `Error` instances as well.
 *
 * @typeParam T - Shape of the expected JSON payload.
 * @param url - Endpoint to call. Must be an absolute URL.
 * @param options - Optional signal and timeout.
 * @returns Parsed JSON payload typed as `T`.
 */
export const fetchJsonWithTimeout = async <T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> => {
  const { signal, timeoutMs = 15_000 } = options
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onAbort)
  }
}
