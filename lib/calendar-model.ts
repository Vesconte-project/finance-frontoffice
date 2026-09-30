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
