/**
 * Synthetic public calendar for browser QA. Symbols come from the market atlas
 * fixture so the ticker index names them; nothing here is a real schedule.
 */
import { tickerIndexFixture } from './market-atlas.mjs'

function shift(date, days) {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export function calendarFixture(startDate, endDate, category = 'all') {
  const symbols = tickerIndexFixture().items.map((item) => item.symbol)
  const rows = []
  const span = Math.round((Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000)
  for (let offset = 0; offset <= span; offset += 1) {
    const date = shift(startDate, offset)
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    // One busy day a week, the rest light, so the board shows both.
    const count = weekday === 3 ? Math.min(24, symbols.length) : weekday === 1 ? 0 : 2 + (offset % 3)
    for (let index = 0; index < count; index += 1) {
      const symbol = symbols[(offset * 5 + index) % symbols.length]
      rows.push({ domain: 'earningsEvents', eventId: `fx-e-${date}-${symbol}`, symbol, eventType: 'earnings', title: 'Earnings 2026Q3 estimated', occursAt: date, occursAtRole: 'report_date', source: 'fixture' })
    }
    if (weekday === 2) rows.push({ domain: 'corporateActions', eventId: `fx-d-${date}`, symbol: symbols[offset % symbols.length], eventType: 'cash_dividend', title: 'cash_dividend ex-date', occursAt: date, occursAtRole: 'ex_date', source: 'fixture' })
    if (weekday === 4) rows.push({ domain: 'economicReleases', eventId: `fx-m-${date}`, symbol: null, eventType: 'release', title: 'Synthetic labour release', occursAt: `${date}T12:30:00Z`, occursAtRole: 'scheduled_release_timestamp_utc', source: 'fixture' })
  }
  const kind = (row) => row.domain === 'economicReleases' ? 'macro' : row.domain === 'earningsEvents' ? 'earnings' : 'dividends'
  const filtered = category === 'all' ? rows : rows.filter((row) => kind(row) === category)
  return { available: true, reason: null, unavailableDomains: [], truncated: false, snapshotMode: 'latest', isPointInTime: false, count: filtered.length, rows: filtered }
}

/** Synthetic atlas relationships for the calendar's "around" filter. */
export function calendarRelationshipsFixture(ticker) {
  const symbols = tickerIndexFixture().items.map((item) => item.symbol)
  if (!symbols.includes(ticker)) return null
  const others = symbols.filter((symbol) => symbol !== ticker)
  return {
    ticker,
    asOf: '2026-10-02',
    window: 252,
    node: { ticker, name: null },
    nodes: [],
    themePeers: others.slice(0, 2).map((symbol) => ({ symbol, strength: 0.6, confidence: 0.8, theme: 'Synthetic theme', themes: ['Synthetic theme'] })),
    residualCoMovers: others.slice(2, 4).map((symbol) => ({ symbol, strength: 0.5, confidence: 0.7, direction: 'positive' })),
    marketCoMovers: [],
    leadLag: { leaders: others.slice(4, 5).map((symbol) => ({ symbol, strength: 0.4, confidence: 0.6, direction: 'leads' })), followers: [] },
    probableSpurious: [],
  }
}
