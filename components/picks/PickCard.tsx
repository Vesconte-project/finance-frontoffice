import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { PickItem } from '@/lib/picks'

/**
 * One ranked company.
 *
 * Rank leads, score follows. The scores come from hand-drawn, uncalibrated curves,
 * so the ordering is the trustworthy part — a card that opened with "82" would be
 * claiming a precision the model does not have.
 */

function strongestComponents(item: PickItem, count: number) {
  return item.components
    .filter((component) => component.available && typeof component.score === 'number')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, count)
}

export function PickHeroCard({ item, rank }: { item: PickItem; rank: number }) {
  const parts = strongestComponents(item, 3)

  return (
    <Card
      padding="none"
      className="picks-hero group relative flex min-h-[280px] flex-col justify-between rounded-[var(--radius-2xl)] border-0 p-6 md:p-7"
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="text-caption inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 uppercase tracking-[0.18em] text-[var(--text)]">
          Rank {rank}
        </div>
        <div className="text-right">
          <div className="numeric-tabular text-3xl font-black leading-none text-[var(--text)]">{item.score}</div>
          <div className="text-caption mt-1 text-[var(--text)]">score</div>
        </div>
      </div>

      <div className="relative z-10 mt-6">
        <Link
          href={`/stocks/${encodeURIComponent(item.symbol)}`}
          className="state-interactive inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <div className="numeric-tabular text-4xl font-black tracking-tight text-[var(--text)] md:text-5xl">
            {item.symbol}
          </div>
          {item.name ? <div className="mt-1 text-lg text-[var(--text)]">{item.name}</div> : null}
        </Link>

        {item.sector ? <div className="text-caption mt-3 text-[var(--text)]">{item.sector}</div> : null}

        {parts.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {parts.map((component) => (
              <span
                key={component.key}
                title={component.detail ?? undefined}
                className="text-caption inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[var(--text)]"
              >
                {component.label}
                <span className="numeric-tabular text-[var(--text)]">{component.score}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export default function PickCard({ item, rank }: { item: PickItem; rank: number }) {
  const parts = strongestComponents(item, 2)

  return (
    <Card className="flex min-h-[184px] flex-col justify-between rounded-[var(--radius-2xl)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-caption uppercase tracking-[0.18em] text-content-muted">Rank {rank}</div>
          <Link
            href={`/stocks/${encodeURIComponent(item.symbol)}`}
            className="state-interactive mt-1 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            <div className="numeric-tabular text-card-title font-black text-content-primary">{item.symbol}</div>
            {item.name ? (
              <div className="mt-0.5 truncate text-body-sm text-content-secondary" title={item.name}>
                {item.name}
              </div>
            ) : null}
          </Link>
        </div>
        <div className="shrink-0 text-right">
          <div className="numeric-tabular text-xl font-bold leading-none text-content-primary">{item.score}</div>
          <div className="text-caption mt-1 text-content-muted">score</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.sector ? <Badge variant="neutral">{item.sector}</Badge> : null}
        {parts.map((component) => (
          <span
            key={component.key}
            title={component.detail ?? undefined}
            className="text-caption text-content-muted"
          >
            {component.label} <span className="numeric-tabular text-content-secondary">{component.score}</span>
          </span>
        ))}
      </div>
    </Card>
  )
}

/**
 * Income carries one number the other readings do not: what a thousand a year of
 * dividends costs to buy. Rendered only where it exists.
 */
export function PickCapitalNote({ value, className }: { value: number | null; className?: string }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

  return (
    <div className={cn('text-caption text-content-muted', className)}>
      <span className="numeric-tabular text-content-secondary">{formatted}</span> buys $1,000 a year
    </div>
  )
}
