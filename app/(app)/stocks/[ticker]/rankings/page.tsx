import StockRankingsResearch from '@/components/stocks/StockRankingsResearch'
import { getTickerReadingsPayload } from '@/lib/canonical-research'
import { parseTickerReadings } from '@/lib/ticker-readings'

/**
 * A company's standing in each ranking. Free to every reader, so nothing here
 * depends on the session.
 */
export default async function StockRankingsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const payload = await getTickerReadingsPayload(ticker).catch(() => null)
  return <StockRankingsResearch ticker={ticker} readings={parseTickerReadings(payload)} />
}
