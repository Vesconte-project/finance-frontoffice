import StockOwnershipResearch from '@/components/stocks/StockOwnershipResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerEquityCapitalEvents } from '@/lib/canonical-research'
import { buybackExecutions } from '@/lib/capital-reading'
import { getStockResearchData } from '@/lib/stock-research'

/** The Spec's buyback chapter reads from 2016. */
const BUYBACKS_SINCE = '2016-01-01'

export default async function OwnershipPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const [data, capital] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getTickerEquityCapitalEvents(ticker, { limit: 500 }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const buybacks = data.kind === 'fund' || !capital?.available ? [] : buybackExecutions(capital.rows, BUYBACKS_SINCE)
  return <StockOwnershipResearch data={data} buybacks={buybacks} />
}
