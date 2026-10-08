import 'server-only'

import { fetchBackendJson } from '@/lib/backend'
import { normalizeTickerIndexPayload, type TickerIndexPayload } from '@/lib/ticker-search'

const TTL_MS = 60 * 60 * 1000

let cached: { at: number; names: Promise<Map<string, string>> } | null = null

function loadNames(): Promise<Map<string, string>> {
  // The index is large; it is read once an hour per server instance and never sent to the browser.
  return fetchBackendJson<TickerIndexPayload>('/tickers/index', {
    context: 'site.calendar.names',
    timeoutMs: 4000,
    init: { cache: 'no-store' },
  }).then((payload) => new Map((normalizeTickerIndexPayload(payload, null)?.items ?? []).map((item) => [item.symbol.toUpperCase(), item.name])))
}

/**
 * Company names for the symbols on a calendar page, from the same ticker index the
 * search uses. Fails open: without the index the calendar shows tickers alone.
 */
export async function getCalendarNames(symbols: Iterable<string>): Promise<Record<string, string>> {
  const wanted = [...new Set([...symbols].map((symbol) => symbol.toUpperCase()))]
  if (!wanted.length) return {}
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const names = loadNames()
    cached = { at: Date.now(), names }
    names.catch(() => { if (cached?.names === names) cached = null })
  }
  try {
    const names = await cached.names
    return Object.fromEntries(wanted.flatMap((symbol) => {
      const name = names.get(symbol)
      return name && name.toUpperCase() !== symbol ? [[symbol, name]] : []
    }))
  } catch (error) {
    console.error('[calendar] company names unavailable', { message: error instanceof Error ? error.message : String(error) })
    return {}
  }
}
