import CurrencyNotice, { keptAsReported } from '@/components/stocks/CurrencyNotice'
import StockEventsResearch from '@/components/stocks/StockEventsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerCorporateActions, getTickerDisclosures, getTickerEvents } from '@/lib/canonical-research'
import { getClosesIn } from '@/lib/finance'
import { getStockResearchIdentity } from '@/lib/stock-research'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** Five years of closes for the timeline's longest window. */
const TIMELINE_DAYS = 1826

export default async function EventsPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ currency?: string | string[] }> }) {
  const { ticker } = await params
  // `?currency=`: amounts in that currency, converted by the backend at each value's date (founder, 2026-11-05).
  const displayCurrency = await resolveDisplayCurrency((await searchParams).currency).catch(() => null)
  // One window, fetched once: ten years back for the events that happened, one ahead for the scheduled.
  const today = new Date()
  const start = new Date(today)
  start.setUTCFullYear(start.getUTCFullYear() - 10)
  const end = new Date(today)
  end.setUTCFullYear(end.getUTCFullYear() + 1)

  const [data, events, disclosures, actions] = await Promise.all([
    getStockResearchIdentity(ticker, displayCurrency).catch(() => null),
    getTickerEvents(ticker, {
      startDate: isoDate(start),
      endDate: isoDate(end),
      latestOnly: true,
      limit: 200,
    }).catch(() => null),
    getTickerDisclosures(ticker, { latestOnly: true, limit: 100 }).catch(() => null),
    // Amounts and dates of dividends and splits, for the chosen event's detail.
    getTickerCorporateActions(ticker, { limit: 200, displayCurrency }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker.toUpperCase()} />
  // Prices only draw the line under the events; without them the events still show. They follow the page's currency.
  const { points } = await getClosesIn(ticker.toUpperCase(), TIMELINE_DAYS, data.displayCurrency).catch(() => ({ points: [], currency: null }))
  const closes = points.map((row) => ({ date: row.date.slice(0, 10), close: row.close }))
  return (
    <>
      <CurrencyNotice display={displayCurrency} listing={data.listingCurrency} summaryConverted={data.displayCurrency !== null} kept={keptAsReported([{ label: 'dividend amounts', read: actions }])} />
      <StockEventsResearch data={data} events={events} disclosures={disclosures} actions={actions} closes={closes} />
    </>
  )
}
