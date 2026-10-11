/** Stay inside the circle this long before auto check-in (avoids GPS jumps). */
export const ENTER_HOLD_MS = 20_000
/** Stay outside this long before auto check-out (avoids a lunch-gate blip). */
export const EXIT_HOLD_MS = 90_000
export const DEFAULT_GEOFENCE_M = 200

export function holdRemaining(startedAt: number | null, holdMs: number, now = Date.now()) {
  if (startedAt == null) return holdMs
  return Math.max(0, holdMs - (now - startedAt))
}

export function formatHold(ms: number) {
  const seconds = Math.ceil(ms / 1000)
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`
  return `${seconds}s`
}
