import StockValuationResearch, {
  VALUATION_METRICS,
  type ValuationBundle,
  type ValuationMetric,
} from '@/components/stocks/StockValuationResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerMarketMetrics } from '@/lib/canonical-research'
import { getStockResearchData } from '@/lib/stock-research'

const MARKET_METRICS: Record<ValuationMetric, string> = {
  pe: 'trailing_pe',
  ps: 'price_to_sales',
  pb: 'price_to_book',
  pfcf: 'price_to_free_cash_flow',
  'ev-ebitda': 'enterprise_value_to_ebitda',
}

export default async function ValuationPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // Every multiple at once. The `?metric=` tab is gone, and `?period=` with it:
  // it was parsed, threaded through every link and never sent anywhere, because
  // `getTickerMarketMetrics` has no period argument.
  const [data, ...payloads] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    ...VALUATION_METRICS.map((metric) => getTickerMarketMetrics(ticker, {
      metric: MARKET_METRICS[metric.key],
      latestOnly: false,
      limit: 250,
    }).catch(() => null)),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const observations = Object.fromEntries(
    VALUATION_METRICS.map((metric, index) => [metric.key, payloads[index]]),
  ) as ValuationBundle
  return <StockValuationResearch data={data} observations={observations} />
}
