/**
 * Small, type-safe readers for Calcite `CustomEvent`s.
 *
 * Calcite exposes its values through `event.target.value`, which the
 * library typings only loosely describe. These helpers centralize the
 * unsafe cast in one place and keep widget code free of `as any`.
 */

/**
 * Extract the current string value from a Calcite input-like element
 * event. Handles both the single-string case and the date-picker range
 * case (which emits a two-item tuple) by returning the first entry.
 *
 * @param event - The Calcite `CustomEvent` received in a handler.
 * @returns The current value, or an empty string when unavailable.
 */
export const readCalciteStringValue = (event: Event): string => {
  const target = (event as CustomEvent).target as unknown as {
    value?: string | string[]
  }
  const raw = target?.value
  if (Array.isArray(raw)) return raw[0] ?? ''
  return typeof raw === 'string' ? raw : ''
}

/**
 * Extract the current numeric value from a `calcite-input-number` event.
 * Returns `null` when the current value cannot be interpreted as a finite
 * number so callers can keep their previous state untouched.
 *
 * @param event - The Calcite `CustomEvent` received in a handler.
 */
export const readCalciteNumberValue = (event: Event): number | null => {
  const value = Number(readCalciteStringValue(event))
  return Number.isFinite(value) ? value : null
}

/**
 * Extract the boolean `checked` flag from a Calcite checkbox event.
 *
 * @param event - The Calcite `CustomEvent` received in a handler.
 */
export const readCalciteCheckedValue = (event: Event): boolean => {
  const target = (event as CustomEvent).target as unknown as {
    checked?: boolean
  }
  return Boolean(target?.checked)
}
