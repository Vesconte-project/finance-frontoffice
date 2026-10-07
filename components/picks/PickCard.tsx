import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { PickItem } from '@/lib/picks'
import styles from './Rankings.module.css'

/**
 * One ranked company.
 *
 * Rank leads, score follows. The scores come from hand-drawn, uncalibrated curves,
 * so the ordering is the trustworthy part — the bars show each part against the
 * others, not a mark out of a hundred.
 */

/** The measured parts in the model's own order, so every card reads the same way down. */
function measuredComponents(item: PickItem, count: number) {
  return item.components
    .filter((component) => component.available && typeof component.score === 'number')
    .slice(0, count)
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Income carries one number the other readings do not: how much stock paid a thousand
 * in dividends over the trailing year. Phrased in the past tense on purpose — a forward
 * "buys $1,000 a year" would promise a payout nobody can guarantee.
 */
function capitalNote(value: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function PickCard({
  item,
  rank,
  index = 0,
  showCapital = false,
  showSector = true,
}: {
  item: PickItem
  rank: number
  /** Position in the rendered grid; staggers the entrance. */
  index?: number
  showCapital?: boolean
  /** Off where every card shares the sector, as on the weekly cut. */
  showSector?: boolean
}) {
  const parts = measuredComponents(item, 3)
  const capital = showCapital ? capitalNote(item.capitalPerThousandIncome) : null

  return (
    <article className={styles.card} style={{ '--i': index } as CSSProperties} data-pick-card="">
      <div className={styles.cardTop}>
        <span className={styles.rank}>{String(rank).padStart(2, '0')}</span>
        <Link href={`/stocks/${encodeURIComponent(item.symbol)}`} className={styles.identity}>
          <span className={styles.ticker}>{item.symbol}</span>
          {item.name ? <span className={styles.name} title={item.name}>{item.name}</span> : null}
        </Link>
        <span className={styles.score}>
          <span className={styles.scoreValue}>{item.score}</span>
          <span className={styles.scoreLabel}>score</span>
        </span>
      </div>

      {showSector && item.sector ? <span className={styles.sector}>{item.sector}</span> : null}

      {parts.length > 0 ? (
        <ul className={styles.parts}>
          {parts.map((component) => (
            <li key={component.key} className={styles.part} title={component.detail ?? undefined}>
              <span className={styles.partLabel}>{component.label}</span>
              <span className={styles.track} aria-hidden="true">
                <span
                  className={styles.fill}
                  style={{ '--w': `${clampPercent(component.score ?? 0)}%`, '--i': index } as CSSProperties}
                />
              </span>
              <span className={styles.partValue}>{component.score}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {capital ? (
        <p className={styles.cardNote}>
          <strong>{capital}</strong> of shares paid $1,000 in dividends last year
        </p>
      ) : null}
    </article>
  )
}
