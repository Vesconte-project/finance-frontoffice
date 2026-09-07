import StockEventsResearch from '@/components/stocks/StockEventsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerDisclosures, getTickerEvents } from '@/lib/canonical-research'
import { getStockResearchData } from '@/lib/stock-research'

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export default async function EventsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  // One window, fetched once. The Upcoming / Recent / History tabs each moved
  // this range and re-requested; the page now splits what comes back into
  // scheduled and past, so nothing is hidden behind a tab the reader has to
  // guess at.
  const today = new Date()
  const start = new Date(today)
  start.setUTCFullYear(start.getUTCFullYear() - 10)
  const end = new Date(today)
  end.setUTCFullYear(end.getUTCFullYear() + 1)

  const [data, events, disclosures] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getTickerEvents(ticker, {
      startDate: isoDate(start),
      endDate: isoDate(end),
      latestOnly: true,
      limit: 200,
    }).catch(() => null),
    getTickerDisclosures(ticker, { latestOnly: true, limit: 100 }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker.toUpperCase()} />
  return <StockEventsResearch data={data} events={events} disclosures={disclosures} />
}
