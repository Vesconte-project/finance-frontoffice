/**
 * Company events placed on the expanded price chart ("Events" layer).
 *
 * The events read model is bitemporal: it returns a row each time an event was
 * observed. A marker is one event, at the date it happened, labelled with its
 * own title. Nothing is inferred about an event's effect on the price.
 */
import { eventCategory } from './calendar-model'

export type EventMarkerCategory = 'earnings' | 'dividends' | 'company'

export type EventMarker = {
  id: string
  /** Day the event happened, YYYY-MM-DD. */
  date: string
  category: EventMarkerCategory
  title: string
}

export type EventRowLike = {
  domain: string
  eventId: string | null
  eventType: string
  title: string
  occursAt: string | null
  knownAt: string | null
}

export const EVENT_CATEGORY_LABEL: Record<EventMarkerCategory, string> = {
  earnings: 'Earnings',
  dividends: 'Dividend',
  company: 'Company event',
}

const DAY = /^\d{4}-\d{2}-\d{2}/

/**
 * One marker per past company event, newest revision first, sorted by date.
 * Identity is the event's own id; without one, its domain, type and title, so a
 * revision that moved the date replaces the earlier date instead of doubling it.
 * Market-wide releases and events still in the future are left out.
 */
export function buildEventMarkers(rows: readonly EventRowLike[], today: string): EventMarker[] {
  const latest = new Map<string, EventRowLike>()
  for (const row of rows) {
    if (!row.occursAt || !DAY.test(row.occursAt) || !row.title?.trim()) continue
    const key = row.eventId?.trim() || `${row.domain}:${row.eventType}:${row.title}`
    const current = latest.get(key)
    if (!current || (row.knownAt ?? '') > (current.knownAt ?? '')) latest.set(key, row)
  }
  const markers: EventMarker[] = []
  for (const [key, row] of latest) {
    const date = row.occursAt!.slice(0, 10)
    if (date > today) continue
    const category = eventCategory(row.domain, row.eventType, row.title)
    if (category === 'macro') continue
    markers.push({ id: key, date, category, title: row.title.trim() })
  }
  return markers.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

/**
 * Index of the trading day an event belongs to: its own day, or the next
 * session when it fell on a closed day. `null` when it lies outside the bars.
 */
export function markerBarIndex(barDates: readonly string[], date: string): number | null {
  if (!barDates.length || date < barDates[0] || date > barDates[barDates.length - 1]) return null
  let low = 0
  let high = barDates.length - 1
  while (low < high) {
    const middle = (low + high) >> 1
    if (barDates[middle] < date) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * Stack level for each marker so that markers closer than `gap` pixels sit one
 * above the other instead of overlapping. Input order is kept in the output.
 */
export function stackMarkerLevels(xs: readonly number[], gap: number): number[] {
  const order = xs.map((x, index) => ({ x, index })).sort((a, b) => a.x - b.x || a.index - b.index)
  const lastXByLevel: number[] = []
  const levels = new Array<number>(xs.length).fill(0)
  for (const { x, index } of order) {
    let level = 0
    while (level < lastXByLevel.length && x - lastXByLevel[level] < gap) level += 1
    lastXByLevel[level] = x
    levels[index] = level
  }
  return levels
}
