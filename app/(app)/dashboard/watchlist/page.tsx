import Link from 'next/link'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import MetricGrid from '@/components/page/MetricGrid'
import RetryButton from '@/components/ui/RetryButton'
import { buttonClass } from '@/components/ui/Button'
import WatchlistTable from '@/components/dashboard/WatchlistTable'
import { getViewerUserId } from '@/lib/auth'
import { getWatchlistWorkspace } from '@/lib/watchlist-workspace'

export const dynamic = 'force-dynamic'

function formatConviction(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)}%`
}

export default async function DashboardWatchlistPage() {
  const userId = await getViewerUserId()

  if (!userId) {
    return (
      <EmptyState
        title="Watchlist is for signed-in users"
        description="Sign in to save tickers and track live model stance across the names you follow."
        action={
          <Link href="/" className={buttonClass({ variant: 'primary' })}>
            Return Home
          </Link>
        }
      />
    )
  }

  let workspace: Awaited<ReturnType<typeof getWatchlistWorkspace>>
  try {
    workspace = await getWatchlistWorkspace()
  } catch {
    return (
      <EmptyState
        title="Watchlist is temporarily unavailable"
        description="The frontend could not load your saved watchlist from finance-backend."
        action={<RetryButton>Retry</RetryButton>}
      />
    )
  }

  const { tickers, watchlistRows, avgConviction, bullishCount, flipsLast30d } = workspace

  return (
    <div className="section-gap">
      <PageHeader
        title="Watchlist"
        subtitle="Track every saved ticker with its live stance, conviction, and most recent signal change."
        action={
          <Link href="/screener" className={buttonClass({ variant: 'secondary' })}>
            Add more signals
          </Link>
        }
      />

      {tickers.length === 0 ? (
        <Card className="surface-primary">
          <h2 className="text-section-title mb-2 text-content-primary">Your watchlist is empty</h2>
          <p className="text-body mb-5">
            Visit any ticker page and click Add to Watchlist to start building your live coverage list.
          </p>
          <Link href="/stocks/SPY" className={buttonClass({ variant: 'primary' })}>
            Open SPY
          </Link>
        </Card>
      ) : (
        <>
          <MetricGrid
            columns={4}
            items={[
              { label: 'Tracked Assets', value: tickers.length.toString() },
              { label: 'Bullish Signals', value: bullishCount.toString() },
              { label: 'Avg Conviction', value: formatConviction(avgConviction) },
              { label: 'Flips (30d)', value: flipsLast30d.toString() },
            ]}
          />
          <WatchlistTable rows={watchlistRows} />
        </>
      )}
    </div>
  )
}
