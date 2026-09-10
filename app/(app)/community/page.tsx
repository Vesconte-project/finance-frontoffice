import Link from 'next/link'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import MetricGrid from '@/components/page/MetricGrid'
import SignalBlock from '@/components/ui/SignalBlock'
import RetryButton from '@/components/ui/RetryButton'
import { buttonClass } from '@/components/ui/Button'
import {
  TableBase,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableShell,
} from '@/components/ui/DataTable'
import { getScreenerSignals } from '@/lib/signals'
import { getAllWatchlistTickers, getWatchlistSubscriptionsForTickers } from '@/lib/watchlist'

export const dynamic = 'force-dynamic'

function formatConviction(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)}%`
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default async function CommunityPage() {
  let crowdRows: Array<{
    ticker: string
    watchers: number
    name: string | null
    direction: 'bullish' | 'neutral' | 'bearish' | null
    conviction: number | null
    signalDate: string | null
    changePercent: number | null
  }> = []

  let totalSubscriptions = 0
  let uniqueTickers = 0

  try {
    const tickers = await getAllWatchlistTickers()
    uniqueTickers = tickers.length
    if (tickers.length > 0) {
      const subscriptions = await getWatchlistSubscriptionsForTickers(tickers)
      totalSubscriptions = subscriptions.length

      const watcherCounts = new Map<string, number>()
      for (const subscription of subscriptions) {
        watcherCounts.set(subscription.ticker, (watcherCounts.get(subscription.ticker) ?? 0) + 1)
      }

      const rankedTickers = [...watcherCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 12)

      const signalRows =
        rankedTickers.length > 0
          ? (
              await getScreenerSignals({
                tickers: rankedTickers.map(([ticker]) => ticker),
                limit: rankedTickers.length,
              })
            ).rows
          : []

      const rowByTicker = new Map(signalRows.map((row) => [row.ticker, row]))

      crowdRows = rankedTickers.map(([ticker, watchers]) => {
        const row = rowByTicker.get(ticker)
        return {
          ticker,
          watchers,
          name: row?.name ?? null,
          direction: row?.direction ?? null,
          conviction: row?.conviction ?? null,
          signalDate: row?.signalDate ?? null,
          changePercent: row?.changePercent ?? null,
        }
      })
    }
  } catch {
    return (
      <EmptyState
        title="Community is temporarily unavailable"
        description="The frontend could not assemble the anonymous crowd view from watchlist data."
        action={<RetryButton>Retry</RetryButton>}
      />
    )
  }

  const crowdLeader = crowdRows[0] ?? null

  if (crowdRows.length === 0) {
    return (
      <div className="container-lg section-gap">
        <PageHeader
          title="Community"
          subtitle="What other users are watching will appear here once there is enough anonymous watchlist activity to show honestly."
          action={
            <Link href="/screener" className={buttonClass({ variant: 'secondary' })}>
              Browse Signals
            </Link>
          }
        />
        <EmptyState
          analyticsId="community_pulse"
          title="Community pulse is still building"
          description="There is no anonymous crowd data to show yet. When watchlist activity grows, this page should surface the most watched names and emerging consensus shifts."
          action={
            <Link
              href="/sign-up"
              data-analytics-id="community_sign_up"
              data-analytics-event="auth_start"
              data-analytics-intent="sign_up"
              className={buttonClass({ variant: 'primary' })}
            >
              Start a watchlist
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="container-lg section-gap">
      <PageHeader
        title="Community"
        subtitle="Anonymous watchlist saves only. No profiles, no chat, just a clean read on what other users are following."
        action={
          <Link href="/screener" className={buttonClass({ variant: 'secondary' })}>
            Open Signals
          </Link>
        }
      />

      <MetricGrid
        columns={4}
        items={[
          { label: 'Watched Tickers', value: uniqueTickers.toString() },
          { label: 'Total Saves', value: totalSubscriptions.toString() },
          {
            label: 'Crowd Leader',
            value: crowdLeader ? `${crowdLeader.ticker} · ${crowdLeader.watchers}` : '—',
          },
          {
            label: 'Bullish Leaders',
            value: crowdRows.filter((row) => row.direction === 'bullish').length.toString(),
          },
        ]}
      />

      <Card className="section-gap">
        <div>
          <h2 className="text-card-title text-content-primary">Most watched right now</h2>
          <p className="text-body mt-2">
            This is the honest version of Community for now: anonymous watchlist concentration plus each name’s current live signal.
          </p>
        </div>

        <TableShell>
          <TableBase className="whitespace-nowrap">
            <TableHead sticky>
              <tr>
                <TableHeaderCell>Ticker</TableHeaderCell>
                <TableHeaderCell sortable sortDirection="desc">Watched By</TableHeaderCell>
                <TableHeaderCell>Live Signal</TableHeaderCell>
                <TableHeaderCell>Conviction</TableHeaderCell>
                <TableHeaderCell>Last Signal</TableHeaderCell>
                <TableHeaderCell>% Chg</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {crowdRows.map((row, index) => (
                <TableRow key={row.ticker} index={index}>
                  <TableCell className="text-label-lg">
                    <Link href={`/stocks/${row.ticker}`} className="text-accent-text hover:underline">
                      {row.ticker}
                    </Link>
                    {row.name ? (
                      <div className="text-caption max-w-[220px] truncate text-content-muted">
                        {row.name}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="numeric-tabular text-content-primary">{row.watchers}</TableCell>
                  <TableCell>
                    {row.direction ? (
                      <SignalBlock
                        direction={row.direction}
                        conviction={row.conviction}
                        compact
                        showLabel={false}
                      />
                    ) : (
                      <span className="text-caption text-content-muted">Unavailable</span>
                    )}
                  </TableCell>
                  <TableCell muted className="numeric-tabular">{formatConviction(row.conviction)}</TableCell>
                  <TableCell muted className="numeric-tabular">{formatDate(row.signalDate)}</TableCell>
                  <TableCell
                    className={
                      (row.changePercent ?? null) === null
                        ? 'text-content-muted'
                        : (row.changePercent ?? 0) >= 0
                          ? 'signal-bullish'
                          : 'signal-bearish'
                    }
                  >
                    {formatPct(row.changePercent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableBase>
        </TableShell>
      </Card>
    </div>
  )
}
