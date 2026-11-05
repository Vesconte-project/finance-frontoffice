import StockBusinessResearch from '@/components/stocks/StockBusinessResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getStockResearchData } from '@/lib/stock-research'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ currency?: string | string[] }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: amounts in that currency, converted by the backend at each value's date (founder, 2026-11-05).
  const displayCurrency = await resolveDisplayCurrency((await searchParams).currency).catch(() => null)
  const data = await getStockResearchData(ticker, displayCurrency).catch(() => null)
  if (!data) return <ResearchUnavailable ticker={ticker} />
  return <StockBusinessResearch data={data} />
}
