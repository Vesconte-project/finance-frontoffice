export type CandleDirection = 'up' | 'down' | 'unknown'

/**
 * A day's direction from its open and close. Without an open from the backend
 * the direction is unknown and drawn neutral, never assumed to be rising.
 */
export function candleDirection(open: number | null | undefined, close: number): CandleDirection {
  if (open === null || open === undefined || !Number.isFinite(open)) return 'unknown'
  return close >= open ? 'up' : 'down'
}
