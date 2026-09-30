import Link from 'next/link'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import MetricGrid from '@/components/page/MetricGrid'
import SignalBlock from '@/components/ui/SignalBlock'
import Badge from '@/components/ui/Badge'
import RetryButton from '@/components/ui/RetryButton'
import { buttonClass } from '@/components/ui/Button'
import { getScreenerSignals, type ScreenerSignal } from '@/lib/signals'

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

type DiscoveryLaneProps = {
  title: string
  body: string
  href: string
  cta: string
  rows: ScreenerSignal[]
}

function DiscoveryLane({ title, body, href, cta, rows }: DiscoveryLaneProps) {
  return (
    <Card className="section-gap">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-card-title text-content-primary">{title}</h2>
          <p className="text-body mt-2">{body}</p>
        </div>
        <Link href={href} className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          {cta}
        </Link>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-body-sm text-content-muted">No live rows are available for this lane right now.</p>
        ) : (
          rows.slice(0, 4).map((row) => (
            <Link
              key={`${title}-${row.ticker}`}
              href={`/stocks/${row.ticker}`}
              className="grid gap-3 rounded-md border border-border bg-surface-elevated px-4 py-3 transition hover:border-primary/20 hover:bg-[var(--surface)] dark:hover:bg-[var(--surface)] sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            >
              <div>
                <div className="text-label-lg text-content-primary">{row.ticker}</div>
                <div className="text-caption mt-1 text-content-muted">
                  {row.name ?? 'Live market signal'}
                </div>
              </div>
              <div className="flex items-center">
                <SignalBlock
                  direction={row.direction}
                  conviction={row.conviction}
                  compact
                  showLabel={false}
                />
              </div>
              <div className="text-right text-body-sm text-content-muted">
                <div>{formatConviction(row.conviction)}</div>
                <div className={(row.changePercent ?? 0) >= 0 ? 'signal-bullish' : 'signal-bearish'}>
                  {formatPct(row.changePercent)}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  )
}

export default async function MarketsPage() {
  let strongest: ScreenerSignal[] = []
  let fresh: ScreenerSignal[] = []
  let movers: ScreenerSignal[] = []

  try {
    const [strongestResult, freshResult, moversResult] = await Promise.all([
      getScreenerSignals({ sortBy: 'conviction', limit: 8 }),
      getScreenerSignals({ sortBy: 'latest', maxSignalAgeDays: 7, limit: 8 }),
      getScreenerSignals({ sortBy: 'movers', maxSignalAgeDays: 7, limit: 8 }),
    ])
    strongest = strongestResult.rows
    fresh = freshResult.rows
    movers = moversResult.rows
  } catch {
    return (
      <EmptyState
        title="Markets is temporarily unavailable"
        description="The frontend could not assemble the discovery lanes from finance-backend."
        action={<RetryButton>Retry</RetryButton>}
      />
    )
  }

  const topConviction = strongest[0] ?? null
  const topMover = movers[0] ?? null

  if (strongest.length === 0 && fresh.length === 0 && movers.length === 0) {
    return (
      <EmptyState
        title="Markets is warming up"
        description="There are no live market discovery lanes to show yet. Open Signals to inspect the raw tape directly."
        action={
          <Link href="/screener" className={buttonClass({ variant: 'primary' })}>
            Open Signals
          </Link>
        }
      />
    )
  }

  return (
    <div className="container-lg section-gap">
      <PageHeader
        title="Markets"
        subtitle="Take multiple paths into the tape: strongest setups, fresh changes, and the names moving hardest."
        action={
          <Link href="/screener" className={buttonClass({ variant: 'secondary' })}>
            Open raw signals
          </Link>
        }
      />

      <MetricGrid
        columns={4}
        items={[
          {
            label: 'Top Conviction',
            value: topConviction ? `${topConviction.ticker} ${formatConviction(topConviction.conviction)}` : '—',
          },
          {
            label: 'Fresh Signals',
            value: fresh.length.toString(),
            hint: 'Seen in the last 7 days',
          },
          {
            label: 'Top Mover',
            value: topMover ? `${topMover.ticker} ${formatPct(topMover.changePercent)}` : '—',
          },
          {
            label: 'Discovery Lanes',
            value: '4 live',
            hint: 'Signals plus correlation network',
          },
        ]}
      />

      <Card className="section-gap">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-card-title text-content-primary">Correlation network</h2>
            <p className="text-body mt-2">
              Explore the precomputed correlation graph with country colour, MST backbone, and ticker neighborhoods.
            </p>
          </div>
          <Link href="/markets/network" className={buttonClass({ variant: 'primary', size: 'sm' })}>
            Open network
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <DiscoveryLane
          title="Strongest signal"
          body="Start with the highest-conviction names across the tape."
          href="/screener?sort=conviction"
          cta="Open lane"
          rows={strongest}
        />
        <DiscoveryLane
          title="Fresh changes"
          body="Catch the newest flips and recent signal updates before they get buried."
          href="/screener?sort=latest&maxAgeDays=7"
          cta="View recent"
          rows={fresh}
        />
        <DiscoveryLane
          title="Market movement"
          body="Look at the names with the biggest daily moves, then confirm whether the model agrees."
          href="/screener?sort=movers&maxAgeDays=7"
          cta="See movers"
          rows={movers}
        />
      </div>

      <Card className="section-gap">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-card-title text-content-primary">Next discovery lenses</h2>
            <p className="text-body mt-2">
              The next pass on Markets should split the tape by investor lens instead of a single ranked list.
            </p>
          </div>
          <Badge variant="neutral">Coming next</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Themes', 'Sectors', 'IPOs', 'ETFs', 'Regime shifts', 'Cross-market heat'].map((label) => (
            <span
              key={label}
              className="inline-flex rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-content-secondary"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="text-body-sm text-content-muted">
          Today this page is powered by live signal ranking only. These additional market lenses still need dedicated data and taxonomy.
        </div>
      </Card>
    </div>
  )
}
