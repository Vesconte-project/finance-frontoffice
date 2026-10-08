export type CalendarCategory = 'all' | 'earnings' | 'dividends' | 'company' | 'macro' | 'holidays'

export type CalendarEvent = {
  id: string
  date: string
  title: string
  category: Exclude<CalendarCategory, 'all' | 'holidays'>
  symbol: string | null
  source: string | null
  detail: string | null
}

export const CALENDAR_CATEGORIES: Array<{ key: CalendarCategory; label: string }> = [
  { key: 'all', label: 'All events' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'dividends', label: 'Dividends' },
  { key: 'company', label: 'Company' },
  { key: 'macro', label: 'Economic releases' },
  { key: 'holidays', label: 'Holidays' },
]

export function calendarMonth(raw: string | null | undefined, fallback = new Date()): string {
  if (raw && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(raw)) return raw
  return fallback.toISOString().slice(0, 7)
}

export function calendarDay(raw: string | null | undefined, month: string): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || !raw.startsWith(`${month}-`)) return null
  const parsed = new Date(`${raw}T12:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === raw ? raw : null
}

export function shiftMonth(month: string, shift: number): string {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1 + shift, 1)).toISOString().slice(0, 7)
}

export function monthBounds(month: string): { start: string; end: string } {
  const [year, number] = month.split('-').map(Number)
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10),
  }
}

export function eventCategory(domain: string, type: string, title: string): CalendarEvent['category'] {
  const phrase = `${type} ${title}`.toLowerCase()
  if (domain === 'economicReleases') return 'macro'
  if (domain === 'earningsEvents' || (domain === 'investorEvents' && phrase.includes('earnings'))) return 'earnings'
  if (domain === 'fundDistributions' || (domain === 'corporateActions' && /dividend|distribution/.test(phrase))) return 'dividends'
  return 'company'
}

export function humanDate(date: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric', ...options })
    .format(new Date(`${date.slice(0, 10)}T12:00:00Z`))
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function validDay(raw: string | null | undefined): string | null {
  if (!raw || !ISO_DAY.test(raw)) return null
  const parsed = new Date(`${raw}T12:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === raw ? raw : null
}

export function shiftDay(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

/** The Monday of the week holding `date` (weeks run Monday to Sunday, in UTC like the rest of the calendar). */
export function weekStart(date: string): string {
  const offset = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
  return shiftDay(date, -offset)
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDay(monday, index))
}

export type CalendarView = 'week' | 'month'

export type CalendarWindow = {
  view: CalendarView
  /** Monday of the week shown, or of the week holding the selected day in the month view. */
  week: string
  month: string
  start: string
  end: string
  thisWeek: string
  /**
   * True when the viewer asked for more than the open window. Nothing is fetched for a
   * locked window: the open window is the current week, read in the week view.
   */
  locked: boolean
}

/**
 * The single rule for how much of the calendar a viewer receives.
 *
 * Anyone can read the current week. Other weeks and the month view need a signed-in
 * account (founder decision, 2026-10-08). The rule decides the date range before the
 * backend is asked, so a signed-out page never carries events outside this week.
 */
export function resolveCalendarWindow({ view, week, month, day, signedIn, today }: {
  view?: string | null
  week?: string | null
  month?: string | null
  day?: string | null
  signedIn: boolean
  today: string
}): CalendarWindow {
  const thisWeek = weekStart(today)
  const resolvedView: CalendarView = view === 'month' ? 'month' : 'week'
  const anchor = validDay(week) ?? validDay(day)
  const shownWeek = anchor ? weekStart(anchor) : thisWeek
  if (resolvedView === 'month') {
    const shownMonth = calendarMonth(month, new Date(`${today}T12:00:00Z`))
    const bounds = monthBounds(shownMonth)
    return { view: 'month', week: shownWeek, month: shownMonth, ...bounds, thisWeek, locked: !signedIn }
  }
  return {
    view: 'week',
    week: shownWeek,
    month: shownWeek.slice(0, 7),
    start: shownWeek,
    end: shiftDay(shownWeek, 6),
    thisWeek,
    locked: !signedIn && shownWeek !== thisWeek,
  }
}

export function humanWeek(monday: string): string {
  const sunday = shiftDay(monday, 6)
  const startFormat: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'short', day: 'numeric' }
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7)
  const sameYear = monday.slice(0, 4) === sunday.slice(0, 4)
  const start = new Intl.DateTimeFormat('en-US', sameYear ? startFormat : { ...startFormat, year: 'numeric' }).format(new Date(`${monday}T12:00:00Z`))
  const endMonth = sameMonth ? '' : `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(new Date(`${sunday}T12:00:00Z`))} `
  return `${start} – ${endMonth}${Number(sunday.slice(8))}, ${sunday.slice(0, 4)}`
}

/** Event wording from the source, readable: `cash_dividend ex-date` → `Cash dividend ex-date`. */
export function readableTitle(title: string): string {
  const spaced = title.replaceAll('_', ' ').replace(/\s+/g, ' ').trim()
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : spaced
}

export function calendarHref({ category, view, week, month, day, focus = {} }: {
  category: CalendarCategory
  view: CalendarView
  week?: string | null
  month?: string | null
  day?: string | null
  focus?: CalendarFocusQuery
}): string {
  const path = `/calendar${category === 'all' ? '' : `/${category}`}`
  const params = new URLSearchParams(focusParams(focus))
  if (view === 'month') {
    params.set('view', 'month')
    if (month) params.set('month', month)
    if (day) params.set('day', day)
  } else if (week) {
    params.set('week', week)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/** Narrowing the calendar to some companies: the reader's watchlist, or a company and what surrounds it in the atlas. */
export type CalendarFocusQuery = { list?: 'watchlist'; around?: string; sector?: string }

export function calendarFocus(raw: { list?: string | null; around?: string | null; sector?: string | null }): CalendarFocusQuery {
  const sector = calendarSector(raw.sector)
  const withSector = sector ? { sector } : {}
  if (raw.list === 'watchlist') return { list: 'watchlist', ...withSector }
  const around = typeof raw.around === 'string' ? raw.around.trim().toUpperCase() : ''
  return /^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(around) ? { around, ...withSector } : withSector
}

export function focusParams(focus: CalendarFocusQuery): Record<string, string> {
  const params: Record<string, string> = {}
  if (focus.list) params.list = focus.list
  else if (focus.around) params.around = focus.around
  if (focus.sector) params.sector = focus.sector
  return params
}

/**
 * Keep company events for the given symbols. Events without a company (economic
 * releases) stay: they bear on every company in the selection.
 */
export function keepCompanies<T extends { symbol: string | null }>(events: T[], symbols: Set<string> | null): T[] {
  if (!symbols) return events
  return events.filter((event) => !event.symbol || symbols.has(event.symbol.toUpperCase()))
}

export function calendarSector(raw: string | null | undefined): string | null {
  const sector = typeof raw === 'string' ? raw.trim() : ''
  return sector && sector.length <= 60 && /^[\p{L}\p{N} &,.'/-]+$/u.test(sector) ? sector : null
}

/** Sectors present among the window's company events, busiest first. */
export function sectorCounts(events: Array<{ symbol: string | null }>, sectors: Map<string, string>): Array<{ sector: string; count: number }> {
  const counts = new Map<string, number>()
  for (const event of events) {
    const sector = event.symbol ? sectors.get(event.symbol.toUpperCase()) : undefined
    if (sector) counts.set(sector, (counts.get(sector) ?? 0) + 1)
  }
  return [...counts].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector))
}

/** Keep company events in one sector; economic releases stay. */
export function keepSector<T extends { symbol: string | null }>(events: T[], sector: string | null, sectors: Map<string, string> | null): T[] {
  if (!sector || !sectors) return events
  return events.filter((event) => !event.symbol || sectors.get(event.symbol.toUpperCase()) === sector)
}
