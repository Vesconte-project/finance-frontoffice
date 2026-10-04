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

export type Box = { left: number; top: number; width: number; height: number }

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height

/**
 * Puts the price reading beside the day it reads: to the right, the left,
 * above or below, whichever first fits inside the chart without covering the
 * point or the reserved corner. Failing all four, the free corner farthest
 * from the point.
 */
export function placeReading(
  point: { x: number; y: number },
  size: { width: number; height: number },
  bounds: { width: number; height: number },
  reserved: Box | null,
): { left: number; top: number } {
  const gap = 14
  const edge = 6
  const clampLeft = (left: number) => Math.max(edge, Math.min(bounds.width - edge - size.width, left))
  const clampTop = (top: number) => Math.max(edge, Math.min(bounds.height - edge - size.height, top))
  const besideTop = clampTop(point.y - size.height * 0.6)
  const candidates = [
    { left: point.x + gap, top: besideTop },
    { left: point.x - gap - size.width, top: besideTop },
    { left: clampLeft(point.x - size.width / 2), top: point.y - gap - size.height },
    { left: clampLeft(point.x - size.width / 2), top: point.y + gap },
  ]
  const target = { left: point.x - 10, top: point.y - 10, width: 20, height: 20 }
  const fits = ({ left, top }: { left: number; top: number }) => {
    const box = { left, top, width: size.width, height: size.height }
    return left >= edge
      && top >= edge
      && left + size.width <= bounds.width - edge
      && top + size.height <= bounds.height - edge
      && !overlaps(box, target)
      && !(reserved && overlaps(box, reserved))
  }
  const placed = candidates.find(fits)
  if (placed) return placed
  const corners = [
    { left: edge, top: edge },
    { left: bounds.width - edge - size.width, top: edge },
    { left: edge, top: bounds.height - edge - size.height },
    { left: bounds.width - edge - size.width, top: bounds.height - edge - size.height },
  ].map(({ left, top }) => ({ left: Math.max(edge, left), top: Math.max(edge, top) }))
  const free = corners.filter((corner) => !(reserved && overlaps({ ...corner, ...size }, reserved)))
  const distance = ({ left, top }: { left: number; top: number }) =>
    Math.hypot(left + size.width / 2 - point.x, top + size.height / 2 - point.y)
  return (free.length ? free : corners).reduce((best, corner) => (distance(corner) > distance(best) ? corner : best))
}
