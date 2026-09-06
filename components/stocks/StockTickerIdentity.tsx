import LoadingPulse from '@/components/ui/LoadingPulse'
import { formatMoney, formatSignedMoney } from '@/lib/currency'
import { cn } from '@/lib/utils'
import styles from './StockTickerIdentity.module.css'

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

function formatCompactPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function deltaClass(value: number): string {
  if (value > 0) return styles.deltaPositive
  if (value < 0) return styles.deltaNegative
  return styles.deltaNeutral
}

type StockTickerIdentityProps = {
  ticker: string
  displayName: string
  currency: string
  price: number | null
  dailyMoveAmount: number | null
  dailyMovePercent: number | null
  identityColor: string
  nameAsHeading?: boolean
  loading?: boolean
}

export default function StockTickerIdentity({
  ticker,
  displayName,
  currency,
  price,
  dailyMoveAmount,
  dailyMovePercent,
  identityColor,
  nameAsHeading = false,
  loading = false,
}: StockTickerIdentityProps) {
  const name = nameAsHeading
    ? <h1 className={styles.name}>{displayName}</h1>
    : <p className={styles.name}>{displayName}</p>

  return (
    <div className={styles.identity}>
      <span
        className={styles.nodeRail}
        data-selected-ticker-node=""
        style={{ ['--selected-node-tone' as never]: identityColor }}
        aria-hidden="true"
      >
        <span className={styles.node} data-selected-ticker-anchor="" />
      </span>
      <div className={styles.nameRow} data-ticker-identity="">
        {name}
        {loading ? (
          <LoadingPulse label={`Loading ${ticker}`} size="compact" />
        ) : (
          <>
            <span className={styles.tickerBadge}>{ticker}</span>
            {isFiniteNumber(price) ? (
              <div className={styles.quote}>
                <strong className={styles.price}>{formatMoney(price, currency)}</strong>
                {isFiniteNumber(dailyMoveAmount) && isFiniteNumber(dailyMovePercent) ? (
                  <span className={cn(styles.delta, deltaClass(dailyMoveAmount))}>
                    {formatSignedMoney(dailyMoveAmount, currency)} ({formatCompactPercent(dailyMovePercent)})
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
