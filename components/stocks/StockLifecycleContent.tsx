import { Suspense } from 'react'
import SuspendedStockHistory from '@/components/stocks/SuspendedStockHistory'
import { getTickerPageSummary } from '@/lib/ticker-data'
import { lifecycleView } from '@/lib/listing-lifecycle'

type StockTickerLayoutProps = { params: Promise<{ ticker: string }>; children: React.ReactNode }

async function ResolvedLifecycleContent({ params, children }: StockTickerLayoutProps) {
  const { ticker } = await params
  // No state, no current indicators: errors and unknown lifecycle values fail closed.
  const summary = await getTickerPageSummary(ticker).catch(() => null)
  if (!summary) return <p role="status">Ticker status is temporarily unavailable. Try again later.</p>
  const lifecycle = lifecycleView(summary)
  if (lifecycle.state === 'unavailable') return <p role="status">Ticker status is temporarily unavailable. Try again later.</p>
  if (lifecycle.state === 'suspended') return <SuspendedStockHistory ticker={ticker.toUpperCase()} summary={summary} lifecycle={lifecycle} />
  return children
}

export default function StockLifecycleContent(props: StockTickerLayoutProps) {
  return <Suspense fallback={<p role="status">Loading ticker data…</p>}><ResolvedLifecycleContent {...props} /></Suspense>
}
