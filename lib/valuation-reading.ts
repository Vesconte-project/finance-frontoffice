/**
 * Reported valuation multiples for the Valuation tab.
 *
 * Each multiple is the series of observations the market-metrics read model
 * reports, one per day. Nothing is derived from it: the usual range, the
 * median and the sector value are statistics the backend owns (ENG-89,
 * ENG-91). The highest point is a reported observation, picked, not computed.
 */

export type MultipleKey = 'pe' | 'ps' | 'pfcf' | 'ev-ebitda'

/** The four multiples of the Spec's "All four" card, in its order. */
export const VALUATION_MULTIPLES: ReadonlyArray<{ key: MultipleKey; label: string; full: string; metric: string }> = [
  { key: 'pe', label: 'P/E', full: 'Price to earnings', metric: 'trailing_pe' },
  { key: 'ps', label: 'P/S', full: 'Price to sales', metric: 'price_to_sales' },
  { key: 'pfcf', label: 'P/FCF', full: 'Price to free cash flow', metric: 'price_to_free_cash_flow' },
  { key: 'ev-ebitda', label: 'EV/EBITDA', full: 'Enterprise value to EBITDA', metric: 'enterprise_value_to_ebitda' },
]

export type MetricRowLike = {
  value: number | null
  observationDate: string
  knownAt: string | null
}

export type MultiplePoint = { date: string; value: number }

/**
 * One value per observation day, oldest first. A day observed more than once
 * keeps its latest-known revision.
 */
export function multipleSeries(rows: readonly MetricRowLike[]): MultiplePoint[] {
  const byDate = new Map<string, { value: number; knownAt: string }>()
  for (const row of rows) {
    if (row.value === null || !Number.isFinite(row.value) || !/^\d{4}-\d{2}-\d{2}/.test(row.observationDate)) continue
    const date = row.observationDate.slice(0, 10)
    const knownAt = row.knownAt ?? ''
    const current = byDate.get(date)
    if (!current || knownAt > current.knownAt) byDate.set(date, { value: row.value, knownAt })
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => ({ date, value: entry.value }))
}

/** The highest reported observation (the latest one on a tie). */
export function highestPoint(points: readonly MultiplePoint[]): { index: number; point: MultiplePoint } | null {
  let best = -1
  points.forEach((point, index) => {
    if (best < 0 || point.value >= points[best].value) best = index
  })
  return best < 0 ? null : { index: best, point: points[best] }
}

const DAY_MS = 86_400_000

function dayNumber(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS
}

/** Position of each date on a time axis, from 0 (first) to 1 (last). */
export function timePositions(dates: readonly string[]): number[] {
  if (dates.length === 0) return []
  const first = dayNumber(dates[0])
  const span = dayNumber(dates[dates.length - 1]) - first
  return dates.map((date) => (span > 0 ? (dayNumber(date) - first) / span : 0.5))
}

export type TimeTick = { position: number; label: string; short: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Axis names for a span of dates: years when it covers more than two years,
 * months otherwise. At most `max` names, spread evenly, so they never collide.
 */
export function timeTicks(dates: readonly string[], max: number): TimeTick[] {
  if (dates.length < 2) return []
  const first = dayNumber(dates[0])
  const last = dayNumber(dates[dates.length - 1])
  const span = last - first
  if (span <= 0) return []
  const ticks: TimeTick[] = []
  const start = new Date(dates[0].slice(0, 10) + 'T00:00:00Z')
  const byYear = span > 730
  const cursor = byYear
    ? new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1))
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  while (cursor.getTime() / DAY_MS <= last) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()
    ticks.push({
      position: (cursor.getTime() / DAY_MS - first) / span,
      label: byYear ? String(year) : month === 0 ? `${MONTHS[month]} ${year}` : MONTHS[month],
      short: byYear ? `'${String(year).slice(-2)}` : MONTHS[month],
    })
    if (byYear) cursor.setUTCFullYear(year + 1)
    else cursor.setUTCMonth(month + 1)
  }
  if (ticks.length <= max) return ticks
  const step = Math.ceil(ticks.length / Math.max(1, max))
  return ticks.filter((_, index) => (ticks.length - 1 - index) % step === 0)
}

/** A multiple as written: 27×, 6.5×, −12×. */
export function formatMultiple(value: number): string {
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  const text = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(abs)
  return `${value < 0 ? '−' : ''}${text}×`
}

export type LineGeometry = { xs: number[]; ys: number[]; path: string }

/**
 * A reported series drawn in a plot box: time across, value up. The value
 * scale spans the series itself (a multiple has no meaningful zero on this
 * chart), with room kept for the labels written above and below.
 */
export function lineGeometry(
  points: readonly MultiplePoint[],
  box: { width: number; height: number },
  { top = 34, bottom = 30, left = 6, right = 6 }: { top?: number; bottom?: number; left?: number; right?: number } = {},
): LineGeometry {
  const positions = timePositions(points.map((point) => point.date))
  const values = points.map((point) => point.value)
  const high = Math.max(...values)
  const low = Math.min(...values)
  const span = high - low || Math.abs(high) || 1
  const pad = high === low ? span / 2 : 0
  const plotWidth = box.width - left - right
  const plotHeight = box.height - top - bottom
  const xs = positions.map((position) => left + position * plotWidth)
  const ys = values.map((value) => top + ((high + pad - value) / (span + pad * 2)) * plotHeight)
  const path = xs.map((x, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${ys[index].toFixed(2)}`).join(' ')
  return { xs, ys, path }
}
