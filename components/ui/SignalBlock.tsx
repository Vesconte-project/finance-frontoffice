import { cn } from '@/lib/utils'
import { convictionBand, convictionPercent, type SignalDirection } from '@/lib/signalSummary'

type SignalBlockProps = {
  direction: SignalDirection
  conviction: number | null
  className?: string
  label?: string
  compact?: boolean
  showLabel?: boolean
}

function directionLabel(direction: SignalDirection): string {
  if (direction === 'bullish') return 'Bullish'
  if (direction === 'bearish') return 'Bearish'
  return 'Neutral'
}

function strengthLabel(direction: SignalDirection, conviction: number | null): string {
  const band = convictionBand(convictionPercent(conviction))
  if (band === 'high') return direction === 'neutral' ? 'High range' : 'High'
  if (band === 'developing') return 'Building'
  if (band === 'weak') return 'Weak'
  return 'No edge'
}

function tonePillClass(direction: SignalDirection): string {
  if (direction === 'bullish') return 'signal-bg-bullish signal-bullish'
  if (direction === 'bearish') return 'signal-bg-bearish signal-bearish'
  return 'signal-bg-neutral signal-neutral'
}

function toneFillClass(direction: SignalDirection): string {
  if (direction === 'bullish') return 'signal-fill-bullish'
  if (direction === 'bearish') return 'signal-fill-bearish'
  return 'signal-fill-neutral'
}

function fillStrengthClass(conviction: number | null): string {
  const band = convictionBand(convictionPercent(conviction))
  if (band === 'high') return 'opacity-100'
  if (band === 'developing') return 'opacity-90'
  if (band === 'weak') return 'opacity-80'
  return 'opacity-65'
}

function formatConviction(conviction: number | null): string {
  const pct = convictionPercent(conviction)
  if (pct === null) return '—'
  return `${Math.round(pct)}%`
}

export default function SignalBlock({
  direction,
  conviction,
  className,
  label = 'Signal',
  compact = false,
  showLabel = true,
}: SignalBlockProps) {
  const pct = convictionPercent(conviction)
  const width = Math.max(6, Math.min(100, pct ?? 0))

  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel ? <div className="text-filter-label">{label}</div> : null}
      <div
        className={cn(
          'state-interactive rounded-[var(--radius-md)] border border-border/85 bg-surface-card px-3 py-2 hover:-translate-y-[1px]',
          compact ? 'px-2.5 py-2' : null
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-label-sm', tonePillClass(direction))}>
            {directionLabel(direction)}
          </span>
          <span className="text-data-sm numeric-tabular text-content-primary">{formatConviction(conviction)}</span>
          <span className="text-caption text-content-muted">{strengthLabel(direction, conviction)}</span>
        </div>
        <div className="relative mt-2 h-2.5 overflow-hidden rounded-full border border-border/60 bg-surface-hover">
          <span className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-border/60" />
          <span className="pointer-events-none absolute left-2/3 top-0 h-full w-px bg-border/60" />
          <div
            className={cn('h-full rounded-full transition-all duration-[var(--motion-normal)]', toneFillClass(direction), fillStrengthClass(conviction))}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  )
}
