import Link from 'next/link'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import MetricGrid from '@/components/page/MetricGrid'
import { buttonClass } from '@/components/ui/Button'
import RetryButton from '@/components/ui/RetryButton'
import SignalBlock from '@/components/ui/SignalBlock'
import WatchlistTable from '@/components/dashboard/WatchlistTable'
import { getViewerUserId } from '@/lib/auth'
import { getWatchlistWorkspace } from '@/lib/watchlist-workspace'
import RecentAiResearchRuns from '@/components/RecentAiResearchRuns'

export const dynamic = 'force-dynamic'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatConviction(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)}%`
}

function timestampOrZero(value: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default async function DashboardPage() {
  const userId = await getViewerUserId()

  if (!userId) {
    return (
      <>
        <EmptyState
          title="Today is for signed-in users"
          description="Sign in to open your daily signal workspace and track the assets you already care about."
          action={
            <Link href="/" className={buttonClass({ variant: 'primary' })}>
              Return Home
            </Link>
          }
        />
      </>
    )
  }

  let workspace: Awaited<ReturnType<typeof getWatchlistWorkspace>>

  try {
    workspace = await getWatchlistWorkspace()
  } catch {
    return (
      <EmptyState
        title="Today is temporarily unavailable"
        description="The frontend could not load your daily watchlist and signal snapshot from finance-backend."
        action={<RetryButton>Retry</RetryButton>}
      />
    )
  }

  const {
    tickers,
    watchlistRows,
    recentAiRuns,
    avgConviction,
    bullishCount,
    flipsLast30d,
    topConvictionRow,
    latestFlipRow,
  } = workspace

  const snapshotRows = [...watchlistRows]
    .sort((left, right) => {
      const convictionDelta = (right.row?.conviction ?? -1) - (left.row?.conviction ?? -1)
      if (convictionDelta !== 0) return convictionDelta
      return timestampOrZero(right.lastFlippedDate) - timestampOrZero(left.lastFlippedDate)
    })
    .slice(0, 5)

  return (
    <div className="section-gap">
        <PageHeader
          title="Today"
          subtitle="Open with the signals, flips, and names on your watchlist that deserve attention right now."
          action={
            <Link href="/screener" className={buttonClass({ variant: 'secondary' })}>
              Browse Signals
            </Link>
          }
        />

        {tickers.length === 0 ? (
          <Card className="surface-primary">
            <h2 className="text-section-title mb-2 text-content-primary">Your watchlist is empty</h2>
            <p className="text-body mb-5">
              Visit any ticker page and click Add to Watchlist to start building your daily tape.
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
                {
                  label: 'Avg Conviction',
                  value: formatConviction(avgConviction),
                },
                { label: 'Flips (30d)', value: flipsLast30d.toString() },
              ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-4">
                <div>
                  <p className="text-caption uppercase tracking-[0.18em] text-content-muted">Strongest signal</p>
                  <h2 className="text-card-title mt-2 text-content-primary">
                    {topConvictionRow ? topConvictionRow.ticker : 'No clear leader'}
                  </h2>
                  <p className="text-body mt-2">
                    {topConvictionRow?.row?.name ?? 'No live conviction leader is available yet.'}
                  </p>
                </div>
                {topConvictionRow?.direction ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <SignalBlock
                      direction={topConvictionRow.direction}
                      conviction={topConvictionRow.row?.conviction ?? null}
                      compact
                      showLabel={false}
                    />
                    <span className="text-body-sm text-content-muted">
                      Conviction {formatConviction(topConvictionRow.row?.conviction ?? null)}
                    </span>
                  </div>
                ) : (
                  <p className="text-body-sm text-content-muted">No live signal is available for this slot.</p>
                )}
              </Card>

              <Card className="space-y-4">
                <div>
                  <p className="text-caption uppercase tracking-[0.18em] text-content-muted">Latest change</p>
                  <h2 className="text-card-title mt-2 text-content-primary">
                    {latestFlipRow ? latestFlipRow.ticker : 'No recent flips'}
                  </h2>
                  <p className="text-body mt-2">
                    {latestFlipRow
                      ? `Last changed on ${formatDate(latestFlipRow.lastFlippedDate)}.`
                      : 'Your watchlist has not logged a recent signal change yet.'}
                  </p>
                </div>
                {latestFlipRow?.direction ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <SignalBlock
                      direction={latestFlipRow.direction}
                      conviction={latestFlipRow.row?.conviction ?? null}
                      compact
                      showLabel={false}
                    />
                    <span className="text-body-sm text-content-muted">
                      Last changed {formatDate(latestFlipRow.lastFlippedDate)}
                    </span>
                  </div>
                ) : (
                  <p className="text-body-sm text-content-muted">Nothing changed recently.</p>
                )}
              </Card>
            </div>

            <div className="section-gap">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-card-title text-content-primary">Watchlist snapshot</h2>
                  <p className="text-body mt-1">The five names with the clearest current signal on your list.</p>
                </div>
                <Link href="/dashboard/watchlist" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
                  Open full watchlist
                </Link>
              </div>
              <WatchlistTable rows={snapshotRows} />
            </div>

            <div className="section-gap">
              <div>
                <h2 className="text-card-title text-content-primary">Recent AI Research</h2>
                <p className="text-body mt-1">Secondary context from the runs you saved most recently.</p>
              </div>
              <RecentAiResearchRuns
                title="Saved Runs"
                runs={recentAiRuns}
                emptyMessage="No saved AI research runs yet."
                compact
                className="border-dashed bg-surface-elevated"
              />
            </div>
          </>
        )}
      </div>
  )
}
