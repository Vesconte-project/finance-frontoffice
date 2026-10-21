import type { ReactNode } from 'react'
import LoadingPulse from '@/components/ui/LoadingPulse'
import type { AssetMetadataParts } from '@/lib/asset-metadata'
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

export type ConvertedPrice = {
  /** "$54.11". */
  text: string
  /** The rate's date, for the tooltip and screen readers ("Sep 29, 2026"); null when unknown. */
  rateDate: string | null
  currency: string
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
  /** Asset type, exchange and currency. */
  metadata?: AssetMetadataParts
  /** Export and watchlist controls. */
  actions?: ReactNode
  /**
   * The latest price in the display currency the URL asks for, as the backend
   * converted it; shown beside the reported price ("₩75,000 ≈ $54.11"), never
   * in its place.
   */
  converted?: ConvertedPrice | null
  /** The listings-and-currency control, shown in place of the currency label. */
  currencyControl?: ReactNode
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
  converted = null,
  currencyControl = null,
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
        <div className={styles.body} data-arrival-part="identity">
          <div className={styles.main} data-ticker-identity="">
            {name}
            {/* The quote and the rail travel as one line beneath the name. */}
            <div className={styles.line}>
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
                  {isFiniteNumber(price) && converted ? (
                    <span
                      className={styles.converted}
                      data-ticker-price-converted={converted.currency}
                      title={`Converted to ${converted.currency}${converted.rateDate ? ` at the exchange rate of ${converted.rateDate}` : ''}. Not a price traded in ${converted.currency}.`}
                    >
                      <span aria-hidden="true">≈ {converted.text}</span>
                      <span className="sr-only">
                        {`, about ${converted.text} converted to ${converted.currency}${converted.rateDate ? ` at the exchange rate of ${converted.rateDate}` : ''}`}
                      </span>
                    </span>
                  ) : null}
                  {isFiniteNumber(price) && isFiniteNumber(dailyMoveAmount) && isFiniteNumber(dailyMovePercent) ? (
                    <span className={cn(styles.delta, deltaClass(dailyMoveAmount))}>
                      {formatSignedMoney(dailyMoveAmount, currency)} ({formatCompactPercent(dailyMovePercent)})
                    </span>
                  ) : null}
                </span>
              )}
              {metadata || actions ? (
                <div className={styles.rail}>
                  {metadata ? (
                    <span
                      className={styles.metadata}
                      title={[metadata.kind, metadata.exchange, metadata.currency].filter(Boolean).join(' · ')}
                      data-ticker-metadata=""
                    >
                      <span className={styles.metaKind}>{metadata.kind}</span>
                      {metadata.exchange ? <span className={styles.metaExchange}>{metadata.exchange}</span> : null}
                      {currencyControl
                        ? <span className={styles.metaCurrency}>{currencyControl}</span>
                        : metadata.currency ? <span className={styles.metaCurrency}>{metadata.currency}</span> : null}
                    </span>
                  ) : null}
                  {actions ? <div className={styles.actions} data-ticker-actions="">{actions}</div> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
