import 'server-only'
import { cache } from 'react'

import { fetchBackendJson } from '@/lib/backend'
import { normalizeTickerIndexPayload, type TickerIndexPayload } from '@/lib/ticker-search'

const loadNames = cache(async (): Promise<Map<string, string>> => {
  return fetchBackendJson<TickerIndexPayload>('/v1/tickers/index', {
    context: 'site.calendar.names',
    timeoutMs: 4000,
    init: { cache: 'no-store' },
  }).then((payload) => new Map((normalizeTickerIndexPayload(payload, null)?.items ?? []).map((item) => [item.symbol.toUpperCase(), item.name])))
})

/**
 * Company names for the symbols on a calendar page, from the same ticker index the
 * search uses. Fails open: without the index the calendar shows tickers alone.
 */
export async function getCalendarNames(symbols: Iterable<string>): Promise<Record<string, string>> {
  const wanted = [...new Set([...symbols].map((symbol) => symbol.toUpperCase()))]
  if (!wanted.length) return {}
  try {
    const names = await loadNames()
    return Object.fromEntries(wanted.flatMap((symbol) => {
      const name = names.get(symbol)
      return name && name.toUpperCase() !== symbol ? [[symbol, name]] : []
    }))
  } catch (error) {
    console.error('[calendar] company names unavailable', { message: error instanceof Error ? error.message : String(error) })
    return {}
  }
}
