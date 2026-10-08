import 'server-only'

import { fetchBackendJson } from '@/lib/backend'
import { eventCategory, monthBounds, type CalendarCategory, type CalendarEvent } from '@/lib/calendar-model'

type PublicRow = {
  domain: string
  eventId: string | null
  symbol: string | null
  eventType: string
  title: string
  occursAt: string | null
  occursAtRole: string
  source: string | null
}

type PublicCalendarPayload = {
  available: boolean
  reason: string | null
  unavailableDomains: string[]
  truncated: boolean
  rows: PublicRow[]
}

export type CalendarResult = {
  available: boolean
  reason: string | null
  unavailableDomains: string[]
  truncated: boolean
  events: CalendarEvent[]
}

export async function getPublicCalendar(month: string, category: CalendarCategory, symbol?: string): Promise<CalendarResult> {
  return getPublicCalendarRange(monthBounds(month), category, symbol)
}

export async function getPublicCalendarRange({ start, end }: { start: string; end: string }, category: CalendarCategory, symbol?: string): Promise<CalendarResult> {
  if (category === 'holidays') return {
    available: false,
    reason: 'Verified country holiday calendars are not connected yet. Exchange closures and national holidays are different schedules, so no dates are inferred here.',
    unavailableDomains: ['countryHolidays'],
    truncated: false,
    events: [],
  }
  const params = new URLSearchParams({ startDate: start, endDate: end, category })
  if (symbol && category !== 'macro') params.set('symbol', symbol)
  try {
    const payload = await fetchBackendJson<PublicCalendarPayload>(`/site/calendar?${params}`, {
      context: `site.calendar.${category}`,
      init: { next: { revalidate: 300 } },
    })
    return {
      available: payload.available,
      reason: payload.reason,
      unavailableDomains: payload.unavailableDomains ?? [],
      truncated: Boolean(payload.truncated),
      events: (payload.rows ?? []).flatMap((row) => {
        if (!row.occursAt || !/^\d{4}-\d{2}-\d{2}/.test(row.occursAt)) return []
        return [{
          id: `${row.domain}:${row.eventId ?? `${row.symbol ?? 'market'}:${row.title}:${row.occursAt}`}`,
          date: row.occursAt.slice(0, 10),
          title: row.title,
          category: eventCategory(row.domain, row.eventType, row.title),
          symbol: row.symbol,
          source: row.source,
          detail: row.domain === 'economicReleases' ? 'Scheduled release · UTC' : null,
        }]
      }),
    }
  } catch {
    return { available: false, reason: 'The event calendar is temporarily unavailable.', unavailableDomains: [], truncated: false, events: [] }
  }
}
