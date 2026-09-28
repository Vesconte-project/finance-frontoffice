import Badge from '@/components/ui/Badge'
import SignalBlock from '@/components/ui/SignalBlock'
import type { SignalDirection } from '@/lib/signalSummary'

type StockInsightSummaryProps = {
  ticker: string
  price: number | null
  dailyMoveAmount: number | null
  dailyMovePercent: number | null
  updatedAt?: string | null
  direction: SignalDirection | null
  conviction: number | null
  horizonDays: number | null
  biasLabel: string
  overviewSummary: string
  flipRatePct: number
  activeSignalsPct: number
  profileState: {
    label: string
    variant: 'success' | 'neutral' | 'warning' | 'danger'
  }
}

function directionHeadline(direction: SignalDirection | null): string {
  if (!direction) return 'Signal regime is still forming'
  if (direction === 'bullish') return 'Bullish regime active'
  if (direction === 'bearish') return 'Bearish regime active'
  return 'Neutral regime active'
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `$${value.toFixed(2)}`
}

function formatSignedMove(amount: number | null, percent: number | null): string {
  if (amount === null && percent === null) return '—'

  const amountPart =
    amount === null || !Number.isFinite(amount) ? null : `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`
  const percentPart =
    percent === null || !Number.isFinite(percent) ? null : `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`

  if (amountPart && percentPart) return `${amountPart} (${percentPart})`
  return amountPart ?? percentPart ?? '—'
}

function formatConviction(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const pct = value > 1 ? value : value * 100
  return `${Math.round(pct)}%`
}

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) return 'Latest available'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'Latest available'

  const diffMs = Date.now() - parsed
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)))
    return `${mins}m ago`
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)))
    return `${hours}h ago`
  }
  const days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
  return `${days}d ago`
}

export default function StockInsightSummary({
  ticker,
  price,
  dailyMoveAmount,
  dailyMovePercent,
  updatedAt,
  direction,
  conviction,
  horizonDays,
  biasLabel,
  overviewSummary,
  flipRatePct,
  activeSignalsPct,
  profileState,
}: StockInsightSummaryProps) {
  const normalizedDirection = direction ?? 'neutral'
  const conciseReasoning = `${biasLabel}. ${horizonDays === null ? 'Horizon unknown' : `${horizonDays}d horizon`}. Flips ${flipRatePct}% with ${activeSignalsPct}% active directional share.`
  const dayMoveTone =
    dailyMoveAmount !== null
      ? dailyMoveAmount > 0
        ? 'signal-bullish'
        : dailyMoveAmount < 0
          ? 'signal-bearish'
          : 'signal-neutral'
      : dailyMovePercent !== null
        ? dailyMovePercent > 0
          ? 'signal-bullish'
          : dailyMovePercent < 0
            ? 'signal-bearish'
            : 'signal-neutral'
        : 'text-content-primary'

  return (
    <div className="rounded-[var(--radius-xl)] border border-border/45 bg-surface-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-filter-label">Decision Dashboard</div>
          <h3 className="mt-1 text-heading-sm text-content-primary">
            {directionHeadline(direction)} for {ticker}
          </h3>
          <p className="mt-2 line-clamp-2 max-w-[52ch] text-body text-content-secondary">{overviewSummary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{formatUpdatedAt(updatedAt)}</Badge>
          <Badge variant={profileState.variant}>{profileState.label}</Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="emphasis-tertiary">
          <div className="text-filter-label">Price</div>
          <div className="mt-1 text-data-md numeric-tabular text-content-primary">{formatPrice(price)}</div>
        </div>
        <div className="emphasis-tertiary">
          <div className="text-filter-label">Day Move</div>
          <div className={`mt-1 text-data-sm numeric-tabular ${dayMoveTone}`}>{formatSignedMove(dailyMoveAmount, dailyMovePercent)}</div>
        </div>
        <div className="emphasis-tertiary">
          <div className="text-filter-label">Conviction</div>
          <div className="mt-1 text-data-sm numeric-tabular text-content-primary">
            {formatConviction(conviction)}
          </div>
        </div>
        <div className="emphasis-tertiary">
          <div className="text-filter-label">Horizon</div>
          <div className="mt-1 text-data-sm numeric-tabular text-content-primary">
            {horizonDays === null ? '—' : `${horizonDays}d`}
          </div>
        </div>
        <div className="emphasis-tertiary">
          <div className="text-filter-label">Active Share</div>
          <div className="mt-1 text-data-sm numeric-tabular text-content-primary">{activeSignalsPct}%</div>
        </div>
        <div className="emphasis-tertiary">
          <div className="text-filter-label">Flip Rate</div>
          <div className="mt-1 text-data-sm numeric-tabular text-content-primary">{flipRatePct}%</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <SignalBlock
          direction={normalizedDirection}
          conviction={conviction}
          label="Direction · Confidence · Strength"
          compact
        />
        <div className="rounded-[var(--radius-lg)] border border-border/70 bg-surface-elevated px-4 py-3">
          <div className="text-filter-label">Key Reasoning</div>
          <p className="mt-2 line-clamp-3 text-body text-content-secondary">{conciseReasoning}</p>
        </div>
      </div>
    </div>
  )
}
