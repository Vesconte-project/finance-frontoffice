import StockValuationResearch from '@/components/stocks/StockValuationResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerMarketMetrics } from '@/lib/canonical-research'
import { getStockResearchData } from '@/lib/stock-research'
import { VALUATION_MULTIPLES, multipleSeries, type MultipleKey, type MultiplePoint } from '@/lib/valuation-reading'

export default async function ValuationPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // The four multiples of the Spec's "All four", every observation the read
  // model holds for each (up to its 1000-row cap), one value per day.
  const [data, ...payloads] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
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
  return <StockValuationResearch data={data} series={series} />
}
