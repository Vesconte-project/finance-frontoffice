import StockBusinessResearch from '@/components/stocks/StockBusinessResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { getStockResearchData } from '@/lib/stock-research'

export default async function BusinessPage({ params, searchParams }: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ currency?: string | string[] }>
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams])
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: the profile's amounts arrive converted by the backend, or are marked as reported.
  const data = await getStockResearchData(ticker, await resolveDisplayCurrency(query.currency)).catch(() => null)
  if (!data) return <ResearchUnavailable ticker={ticker} />
  return <StockBusinessResearch data={data} />
}
