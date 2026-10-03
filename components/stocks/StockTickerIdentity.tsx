import type { ReactNode } from 'react'
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
  /** Asset type, exchange and currency line. */
  metadata?: ReactNode
  /** Export and watchlist controls. */
  actions?: ReactNode
}

/**
 * The ticker hero's identity block. Its layout follows the width the block is
 * given, not the device: the name keeps priority, the ticker and price move as
 * one unit, and the name is shortened only when it alone cannot fit its line.
 */
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
  metadata,
  actions,
}: StockTickerIdentityProps) {
  const name = nameAsHeading
    ? <h1 className={styles.name} title={displayName} data-ticker-name="">{displayName}</h1>
    : <p className={styles.name} title={displayName} data-ticker-name="">{displayName}</p>

  return (
    <div className={styles.frame}>
      <div className={styles.identity}>
        <span
          className={styles.nodeRail}
          data-selected-ticker-node=""
          style={{ ['--selected-node-tone' as never]: identityColor }}
          aria-hidden="true"
        >
          <span className={styles.node} data-selected-ticker-anchor="" />
        </span>
        <div className={styles.body}>
          <div className={styles.main} data-ticker-identity="">
            {name}
            {loading ? (
              <span className={styles.quote}>
                <LoadingPulse label={`Loading ${ticker}`} size="compact" />
              </span>
            ) : (
              <span className={styles.quote} data-ticker-quote="">
                <span className={styles.quoteLead}>
                  <span className={styles.tickerBadge} data-ticker-symbol="">{ticker}</span>
                  {isFiniteNumber(price) ? (
                    <strong className={styles.price} data-ticker-price="">{formatMoney(price, currency)}</strong>
                  ) : null}
                </span>
                {isFiniteNumber(price) && isFiniteNumber(dailyMoveAmount) && isFiniteNumber(dailyMovePercent) ? (
                  <span className={cn(styles.delta, deltaClass(dailyMoveAmount))}>
                    {formatSignedMoney(dailyMoveAmount, currency)} ({formatCompactPercent(dailyMovePercent)})
                  </span>
                ) : null}
              </span>
            )}
          </div>
          {metadata || actions ? (
            <div className={styles.rail}>
              {metadata ? <span className={styles.metadata} data-ticker-metadata="">{metadata}</span> : null}
              {actions ? <div className={styles.actions} data-ticker-actions="">{actions}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
