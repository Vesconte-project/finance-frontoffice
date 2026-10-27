import 'server-only'
import { BackendDataError } from './backend'
import { getTickerDisclosures, getTickerEvents } from './canonical-research'
import { buildEventMarkers } from './event-markers'

/** Optional chart layer. No reads run until the expanded chart requests it. */
export async function chartEventsResponse(ticker: string): Promise<Response> {
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker)) return Response.json({ error: 'Invalid ticker' }, { status: 400 })
  try {
    const today = new Date().toISOString().slice(0, 10)
    const start = new Date(Date.now() - 3650 * 86400000).toISOString().slice(0, 10)
    const [events, disclosures] = await Promise.all([
      getTickerEvents(ticker, { startDate: start, endDate: today, latestOnly: true, limit: 200 }),
      getTickerDisclosures(ticker, { latestOnly: true, limit: 100 }).catch(() => null),
    ])
    if (!events.available || !Array.isArray(events.rows)) throw new Error('Events unavailable')
    const guidance = disclosures?.available && Array.isArray(disclosures.rows)
      ? disclosures.rows.filter(row => row.domain === 'guidance' && (row.occursAt ?? '') >= start) : []
    return Response.json(buildEventMarkers([...events.rows, ...guidance], today), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const status = error instanceof BackendDataError && [429, 503].includes(error.status ?? 0) ? error.status! : 502
    return Response.json({ error: 'Chart events are temporarily unavailable.' }, { status,
      headers: { 'Cache-Control': 'private, no-store', ...([429, 503].includes(status) ? {
        'Retry-After': error instanceof BackendDataError && error.retryAfter ? error.retryAfter : '60',
      } : {}) } })
  }
}
