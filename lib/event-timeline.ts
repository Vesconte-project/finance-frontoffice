/**
 * The Events tab's timeline: a company's price over a chosen window with its
 * events on the days they happened, and the scheduled ones after today.
 *
 * Everything placed comes from the backend: reported closes, and events at
 * their own dates. The only arithmetic is the next session's move, the same
 * reported-close change the expanded chart's events layer shows.
 */
import { markerBarIndex, nextSessionChange, stackMarkerLevels, type EventMarkerCategory } from './event-markers'

export type TimelineRange = '1Y' | '2Y' | '5Y'
export const TIMELINE_RANGES: readonly TimelineRange[] = ['1Y', '2Y', '5Y']
const RANGE_DAYS: Record<TimelineRange, number> = { '1Y': 365, '2Y': 730, '5Y': 1826 }

export type TimelineClose = { date: string; close: number }
export type TimelineEvent = { id: string; date: string; category: EventMarkerCategory; title: string }

export type PlacedEvent = TimelineEvent & {
  /** Position across the plot, 0–width. */
  x: number
  /** Stack level above the price line, so close events never overlap. */
  level: number
  /** The close the stem points at; null for a scheduled event. */
  y: number | null
  upcoming: boolean
  /** Next session's close against the event day's, in percent; null when unknown or scheduled. */
  nextSession: number | null
  /** Whole days from today to a scheduled event. */
  daysAway: number | null
}

export type TimelineGeometry = {
  width: number
  height: number
  /** Top of the price area: the event lanes sit above it. */
  plotTop: number
  start: string
  end: string
  today: string
  /** x of today; everything right of it is scheduled. */
  todayX: number
  line: string
  area: string
  low: number
  high: number
  events: PlacedEvent[]
  /** Month ticks along the bottom. */
  ticks: Array<{ x: number; label: string }>
}

const DAY_MS = 86_400_000
const toTime = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10)

export function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS)
}

/**
 * The window shown: the range back from today, and forward to the last scheduled
 * event (at least a month, at most a year), so what is coming has room too.
 */
export function timelineWindow(range: TimelineRange, today: string, upcoming: readonly TimelineEvent[]): { start: string; end: string } {
  const start = toDate(toTime(today) - RANGE_DAYS[range] * DAY_MS)
  const furthest = upcoming.reduce((latest, event) => (event.date > latest ? event.date : latest), today)
  const ahead = Math.min(365, Math.max(30, daysBetween(today, furthest) + 14))
  return { start, end: toDate(toTime(today) + ahead * DAY_MS) }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function timelineGeometry(input: {
  closes: readonly TimelineClose[]
  past: readonly TimelineEvent[]
  upcoming: readonly TimelineEvent[]
  range: TimelineRange
  today: string
  width: number
  height: number
  /** Minimum gap between two markers on one level, in plot units. */
  gap: number
}): TimelineGeometry {
  const { width, height, today } = input
  const { start, end } = timelineWindow(input.range, today, input.upcoming)
  const t0 = toTime(start)
  const span = Math.max(1, toTime(end) - t0)
  // Room at both ends so a marker on the first or last day is not cut in half.
  const edge = Math.max(10, input.gap * 0.6)
  const xOf = (date: string) => edge + ((toTime(date) - t0) / span) * (width - edge * 2)
  const closes = input.closes.filter((point) => point.date >= start && point.date <= today && Number.isFinite(point.close))
  const lanes = 4
  const laneHeight = Math.max(14, height * 0.07)
  const plotTop = lanes * laneHeight + 8
  const bottom = height - 22
  const values = closes.map((point) => point.close)
  const low = values.length ? Math.min(...values) : 0
  const high = values.length ? Math.max(...values) : 1
  const pad = (high - low || Math.abs(high) || 1) * 0.08
  const yOf = (value: number) => bottom - ((value - (low - pad)) / (high + pad - (low - pad))) * (bottom - plotTop)
  const round = (value: number) => Math.round(value * 10) / 10
  const path = closes.map((point, index) => `${index ? 'L' : 'M'} ${round(xOf(point.date))} ${round(yOf(point.close))}`).join(' ')
  const area = closes.length
    ? `${path} L ${round(xOf(closes[closes.length - 1].date))} ${bottom} L ${round(xOf(closes[0].date))} ${bottom} Z`
    : ''

  const dates = closes.map((point) => point.date)
  const prices = closes.map((point) => point.close)
  const inWindow = [
    ...input.past.filter((event) => event.date >= start && event.date <= today).map((event) => ({ event, upcoming: false })),
    ...input.upcoming.filter((event) => event.date > today && event.date <= end).map((event) => ({ event, upcoming: true })),
  ]
  const xs = inWindow.map(({ event }) => xOf(event.date))
  const levels = stackMarkerLevels(xs, input.gap)
  const events: PlacedEvent[] = inWindow.map(({ event, upcoming }, index) => {
    const bar = upcoming ? null : markerBarIndex(dates, event.date)
    return {
      ...event,
      x: round(xs[index]),
      level: Math.min(lanes - 1, levels[index]),
      y: bar === null ? null : round(yOf(prices[bar])),
      upcoming,
      nextSession: bar === null ? null : nextSessionChange(prices, bar),
      daysAway: upcoming ? daysBetween(today, event.date) : null,
    }
  })

  // A tick on the first of each month, thinned so labels keep about 70 units apart.
  const ticks: TimelineGeometry['ticks'] = []
  const first = new Date(t0)
  let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)
  const every = Math.max(1, Math.ceil(70 / ((30 * DAY_MS) / span * (width - edge * 2))))
  let count = 0
  while (cursor <= toTime(end)) {
    const date = new Date(cursor)
    if (count % every === 0) {
      const month = date.getUTCMonth()
      ticks.push({ x: round(xOf(toDate(cursor))), label: month === 0 ? String(date.getUTCFullYear()) : MONTHS[month] })
    }
    count += 1
    cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  }

  return {
    width,
    height,
    plotTop,
    start,
    end,
    today,
    todayX: round(xOf(today)),
    line: path,
    area,
    low,
    high,
    events,
    ticks,
  }
}

/** The y of an event's marker dot, in its lane above the price area. */
export function laneY(geometry: TimelineGeometry, level: number): number {
  const lanes = 4
  const laneHeight = (geometry.plotTop - 8) / lanes
  return geometry.plotTop - 8 - laneHeight * (level + 0.5)
}
