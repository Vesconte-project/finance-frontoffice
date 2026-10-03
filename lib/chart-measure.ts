/*
 * Measurement between two days on a price chart (PRD-76).
 *
 * Both ends snap to a day and use that day's close as the backend supplied it.
 * The result is arithmetic on those two real closes; nothing is estimated.
 */

/** A touch must stay still this long before it starts a measurement. */
export const LONG_PRESS_MS = 400

/** Movement that cancels a pending long press, or starts a mouse drag. */
export const LONG_PRESS_SLOP_PX = 8

export type MeasurePoint = { date: string; value: number }

export type Measurement = {
  from: MeasurePoint
  to: MeasurePoint
  change: number
  /** Null when the earlier close is zero and a percentage is undefined. */
  percent: number | null
  calendarDays: number
  /** Trading sessions elapsed between the two days. */
  sessions: number
  direction: 'up' | 'down' | 'flat'
}

const DAY_MS = 86_400_000

function dayValue(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime()
}

/**
 * Change from the earlier to the later of two picked days, whichever order
 * they were picked in. Returns null for a single day or an index outside the
 * series.
 */
export function measureBetween(points: readonly MeasurePoint[], first: number, second: number): Measurement | null {
  const a = Math.round(Math.min(first, second))
  const b = Math.round(Math.max(first, second))
  if (a === b || a < 0 || b >= points.length) return null
  const from = points[a]
  const to = points[b]
  const change = to.value - from.value
  return {
    from,
    to,
    change,
    percent: from.value === 0 ? null : (change / Math.abs(from.value)) * 100,
    calendarDays: Math.round((dayValue(to.date) - dayValue(from.date)) / DAY_MS),
    sessions: b - a,
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  }
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

export function formatSpan(measurement: Measurement): string {
  const days = `${measurement.calendarDays} ${measurement.calendarDays === 1 ? 'day' : 'days'}`
  const sessions = `${measurement.sessions} ${measurement.sessions === 1 ? 'session' : 'sessions'}`
  return `${days} · ${sessions}`
}
