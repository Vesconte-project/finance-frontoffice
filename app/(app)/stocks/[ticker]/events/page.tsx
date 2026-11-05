import StockEventsResearch from '@/components/stocks/StockEventsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerCorporateActions, getTickerDisclosures, getTickerEvents } from '@/lib/canonical-research'
import { getOhlcData } from '@/lib/finance'
import { getStockResearchIdentity } from '@/lib/stock-research'

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** Five years of closes for the timeline's longest window. */
const TIMELINE_DAYS = 1826

export default async function EventsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  // One window, fetched once: ten years back for the events that happened, one ahead for the scheduled.
  const today = new Date()
  const start = new Date(today)
  start.setUTCFullYear(start.getUTCFullYear() - 10)
  const end = new Date(today)
  end.setUTCFullYear(end.getUTCFullYear() + 1)

  const [data, events, disclosures, actions, ohlc] = await Promise.all([
    getStockResearchIdentity(ticker).catch(() => null),
    getTickerEvents(ticker, {
      startDate: isoDate(start),
      endDate: isoDate(end),
      latestOnly: true,
      limit: 200,
    }).catch(() => null),
    getTickerDisclosures(ticker, { latestOnly: true, limit: 100 }).catch(() => null),
    // Amounts and dates of dividends and splits, for the chosen event's detail.
    getTickerCorporateActions(ticker, { limit: 200 }).catch(() => null),
    // Prices only draw the line under the events; without them the events still show.
    getOhlcData(ticker.toUpperCase(), TIMELINE_DAYS).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker.toUpperCase()} />
  const closes = (ohlc?.rows ?? []).map((row) => ({ date: row.date.slice(0, 10), close: row.close }))
  return <StockEventsResearch data={data} events={events} disclosures={disclosures} actions={actions} closes={closes} />
}
