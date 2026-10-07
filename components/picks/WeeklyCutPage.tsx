import Link from 'next/link'
import RetryButton from '@/components/ui/RetryButton'
import PickCard from '@/components/picks/PickCard'
import PickDisclosure from '@/components/picks/PickDisclosure'
import RankingsNav from '@/components/picks/RankingsNav'
import { getSectorCut, type SectorCut } from '@/lib/picks'
import {
  PICK_READING_CONTENT,
  PICK_READING_TO_SLUG,
  PICK_SCORE_CAVEAT,
  formatSnapshotDate,
} from '@/lib/picks-content'
import { weeklyCutFor } from '@/lib/picks-weekly'
import styles from './Rankings.module.css'

/**
 * The free weekly ranking: the top ten of one reading inside one sector.
 *
 * Open to every reader, so nothing here goes through the tier cut. Which reading and
 * sector run is decided by the date (`lib/picks-weekly.ts`), never by hand.
 */
export default async function WeeklyCutPage() {
  const week = weeklyCutFor(new Date())
  const content = PICK_READING_CONTENT[week.reading]
  const readingHref = `/picks/${PICK_READING_TO_SLUG[week.reading]}`
  const weekLabel = formatSnapshotDate(week.weekStart)

  let cut: SectorCut | 'unavailable'
  try {
    cut = await getSectorCut(week.reading, week.sector)
  } catch (error) {
    console.error('[picks] weekly cut unavailable', {
      reading: week.reading,
      sector: week.sector,
      message: error instanceof Error ? error.message : String(error),
    })
    cut = 'unavailable'
  }

  const ranking = cut !== 'unavailable' && cut.status === 'ok' && cut.ranking.items.length > 0 ? cut.ranking : null
  const state = cut === 'unavailable' ? 'unavailable' : ranking ? 'ok' : 'unpublished'
  const asOfLabel = ranking ? formatSnapshotDate(ranking.asOf) : null

  return (
    <div className={styles.page} data-weekly-cut={state}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.eyebrow}>This week · Free</p>
            <h1 className={styles.title}>{week.sector}</h1>
            <p className={styles.subtitle}>
              The top ten on{' '}
              <Link href={readingHref} className={styles.inlineLink}>
                {content.label.toLowerCase()}
              </Link>
              . A new sector every Monday, picked by the calendar.
            </p>
          </div>
          {weekLabel ? (
            <span className={styles.stamp}>
              <span className={styles.stampDot} aria-hidden="true" />
              Week of {weekLabel}
            </span>
          ) : null}
        </div>
        <RankingsNav active="weekly" />
      </header>

      {state === 'unavailable' ? (
        <div className={styles.empty} data-analytics-id="picks_weekly_unavailable">
          <h2 className={styles.emptyTitle}>This week&apos;s ranking is temporarily unavailable</h2>
          <p className={styles.emptyText}>The latest snapshot did not load. Nothing is wrong with your account.</p>
          <RetryButton analyticsId="picks_weekly_retry">Retry</RetryButton>
        </div>
      ) : null}

      {state === 'unpublished' ? (
        <div className={styles.empty} data-analytics-id="picks_weekly_unpublished">
          <h2 className={styles.emptyTitle}>Not published yet</h2>
          <p className={styles.emptyText}>
            Sector rankings are on their way. Until then, any company&apos;s standing is free on its own page.
          </p>
        </div>
      ) : null}

      {ranking ? (
        <div className={styles.main}>
          <div className={styles.grid}>
            {ranking.items.map((item, index) => (
              <PickCard key={item.symbol} item={item} rank={index + 1} index={index} showCapital={week.reading === 'income'} showSector={false} />
            ))}
          </div>
          <p className={styles.caveat}>
            {PICK_SCORE_CAVEAT} Ranks are within {week.sector} only.
          </p>
          <PickDisclosure asOfLabel={asOfLabel} />
        </div>
      ) : null}
    </div>
  )
}
