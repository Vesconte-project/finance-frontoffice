import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Lock } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import type { PickTier } from '@/lib/picks-access-rules'
import styles from './Rankings.module.css'

/**
 * The ranking a reader is not entitled to, drawn as its silhouette.
 *
 * The ghost cards are built from nothing: no rank, no blurred real data and no
 * hidden payload behind them, because the rows they stand for were dropped
 * server-side in `lib/picks-access.ts` — `lockedCount` is a number, not a list.
 * What stays free is pointed to: a company's own standing, and the weekly ranking.
 */
export default function PickLockedRows({
  lockedCount,
  totalRanked,
  tier,
}: {
  lockedCount: number
  totalRanked: number
  tier: PickTier
}) {
  if (lockedCount <= 0) return null

  const ghosts = Math.min(lockedCount, 6)

  return (
    <div className={styles.locked} data-picks-locked="">
      <ul className={`${styles.grid} ${styles.ghostGrid}`} aria-hidden="true">
        {Array.from({ length: ghosts }, (_, index) => (
          <li key={index} className={styles.ghost} style={{ '--i': index } as CSSProperties}>
            <div className={styles.ghostTop}>
              <span className={styles.ghostBar} style={{ width: '1.5rem' }} />
              <span className={styles.ghostBar} style={{ width: '4rem' }} />
              <span className={styles.ghostBar} style={{ width: '2rem', marginLeft: 'auto' }} />
            </div>
            <span className={styles.ghostBar} style={{ width: '45%' }} />
            <span className={styles.ghostBar} style={{ width: '80%', height: '0.375rem' }} />
            <span className={styles.ghostBar} style={{ width: '65%', height: '0.375rem' }} />
          </li>
        ))}
      </ul>

      <div className={styles.offer}>
        <span className={styles.offerIcon} aria-hidden="true">
          <Lock className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <h2 className={styles.offerCount}>
          <span>{totalRanked}</span> companies ranked
        </h2>
        <p className={styles.offerText}>The current order is part of a paid plan.</p>
        <div className={styles.offerActions}>
          <Link href="/pricing" data-analytics-id="picks_locked_pricing" className={buttonClass({ variant: 'primary' })}>
            See plans
          </Link>
          <Link href="/picks/weekly" data-analytics-id="picks_locked_weekly" className={buttonClass({ variant: 'secondary' })}>
            This week&apos;s free ranking
          </Link>
        </div>
        {tier === 'anonymous' ? (
          <p className={styles.offerSignIn}>
            Already a member?{' '}
            <Link href="/sign-in" data-analytics-id="picks_locked_sign_in" data-analytics-event="auth_start" data-analytics-intent="sign_in">
              Sign in
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}
