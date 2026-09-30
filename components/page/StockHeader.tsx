import Badge from '@/components/ui/Badge'
import { HandScript } from '@/components/marketing/site-chrome'

type StockSignalTone = 'bullish' | 'bearish' | 'neutral'

type StockHeaderProps = {
  companyName?: string | null
  ticker: string
  price?: number | null
  dailyMove?: {
    amount?: number | null
    percent?: number | null
  }
  signal?: {
    label: string
    tone: StockSignalTone
  }
  watchlistAction?: React.ReactNode
  primaryCta?: React.ReactNode
  subtitle?: React.ReactNode
}

function signalVariant(tone: StockSignalTone): 'success' | 'danger' | 'neutral' {
  if (tone === 'bullish') return 'success'
  if (tone === 'bearish') return 'danger'
  return 'neutral'
}

function dailyMoveClass(amount?: number | null): string {
  if (amount === null || amount === undefined) return 'text-content-muted'
  if (amount > 0) return 'signal-bullish'
  if (amount < 0) return 'signal-bearish'
  return 'signal-neutral'
}

export default function StockHeader({
  companyName,
  ticker,
  price,
  dailyMove,
  signal,
  watchlistAction,
  primaryCta,
  subtitle,
}: StockHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page-title tracking-tight text-content-primary">
            {ticker}
          </h1>
          {companyName ? (
            <span className="text-body-lg text-content-secondary">{companyName}</span>
          ) : null}
          {signal ? (
            <Badge variant={signalVariant(signal.tone)}>{signal.label}</Badge>
          ) : null}
        </div>

        <HandScript className="mt-2 block text-[1.9rem] leading-none text-[var(--text)]">
          Live tape. Real calm.
        </HandScript>

        {price !== null && price !== undefined ? (
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <span className="text-display-md numeric-tabular leading-none text-content-primary">
              ${price.toFixed(2)}
            </span>
            {(dailyMove?.amount !== null && dailyMove?.amount !== undefined) ||
            (dailyMove?.percent !== null && dailyMove?.percent !== undefined) ? (
              <span className={`text-data-md numeric-tabular mb-1 ${dailyMoveClass(dailyMove?.amount)}`}>
                {dailyMove?.amount !== null && dailyMove?.amount !== undefined
                  ? `${dailyMove.amount >= 0 ? '+' : ''}${dailyMove.amount.toFixed(2)}`
                  : '—'}
                {dailyMove?.percent !== null && dailyMove?.percent !== undefined
                  ? ` (${dailyMove.percent >= 0 ? '+' : ''}${dailyMove.percent.toFixed(2)}%)`
                  : ''}
              </span>
            ) : null}
          </div>
        ) : null}

        {subtitle ? <div className="text-body mt-2">{subtitle}</div> : null}
      </div>

      {(watchlistAction || primaryCta) ? (
        <div className="flex flex-wrap items-center gap-2">
          {watchlistAction}
          {primaryCta}
        </div>
      ) : null}
    </div>
  )
}
