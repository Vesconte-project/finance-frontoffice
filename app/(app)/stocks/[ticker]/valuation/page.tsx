import CurrencyNotice, { keptAsReported } from '@/components/stocks/CurrencyNotice'
import StockValuationResearch from '@/components/stocks/StockValuationResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerMarketMetrics } from '@/lib/canonical-research'
import { getStockResearchData } from '@/lib/stock-research'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { VALUATION_MULTIPLES, multipleSeries, type MultipleKey, type MultiplePoint } from '@/lib/valuation-reading'

export default async function ValuationPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ currency?: string | string[] }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: amounts in that currency, converted by the backend at each value's date (founder, 2026-11-05).
  const displayCurrency = await resolveDisplayCurrency((await searchParams).currency).catch(() => null)
  // The four multiples of the Spec's "All four", every observation the read
  // model holds for each (up to its 1000-row cap), one value per day.
  const [data, ...payloads] = await Promise.all([
    getStockResearchData(ticker, displayCurrency).catch(() => null),
    ...VALUATION_MULTIPLES.map((multiple) => getTickerMarketMetrics(ticker, {
      metric: multiple.metric,
      latestOnly: false,
      limit: 1000,
    }).catch(() => null)),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const series = Object.fromEntries(
    VALUATION_MULTIPLES.map((multiple, index) => {
      const payload = payloads[index]
      return [multiple.key, payload?.available ? multipleSeries(payload.rows) : []]
    }),
  ) as Record<MultipleKey, MultiplePoint[]>
  return (
    <>
      <CurrencyNotice display={displayCurrency} listing={data.listingCurrency} summaryConverted={data.displayCurrency !== null} kept={keptAsReported([])} />
      <StockValuationResearch data={data} series={series} />
    </>
  )
}
