import RetryButton from '@/components/ui/RetryButton'
import PickCard from '@/components/picks/PickCard'
import PickDisclosure from '@/components/picks/PickDisclosure'
import PickLockedRows from '@/components/picks/PickLockedRows'
import PickReadingRail from '@/components/picks/PickReadingRail'
import RankingsNav from '@/components/picks/RankingsNav'
import { resolveVisiblePicks } from '@/lib/picks-access'
import { PICK_READING_CONTENT, PICK_SCORE_CAVEAT, formatSnapshotDate, type PickReadingKey } from '@/lib/picks-content'
import styles from './Rankings.module.css'

/**
 * The body of a ranking page, shared by the three routes. Every row gets the same card:
 * a featured first place would read as "buy this one", and the gap between neighbouring
 * ranks is smaller than the model can resolve.
 *
 * The routes are static paths rather than one `[reading]` segment on purpose. With a
 * dynamic segment, an unknown slug can only be rejected during render — and by then a
 * `force-dynamic` response has begun streaming, so `notFound()` renders the 404 body
 * under a 200 status. Three real routes make an unknown path miss the router
 * entirely, which is a true 404 with no code involved.
 *
 * The entitlement cut happens in `resolveVisiblePicks`, server-side, before anything
 * reaches this component. Nothing here filters or hides rows.
 */
export default async function PicksReadingPage({ reading }: { reading: PickReadingKey }) {
  const content = PICK_READING_CONTENT[reading]
  const result = await resolveVisiblePicks(reading)
  const asOfLabel = result.status === 'ok' ? formatSnapshotDate(result.asOf) : null

  const head = (
    <header className={styles.head}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Rankings</p>
          <h1 className={styles.title}>{content.label}</h1>
          <p className={styles.subtitle}>{content.subtitle}</p>
        </div>
        {asOfLabel ? (
          <span className={styles.stamp}>
            <span className={styles.stampDot} aria-hidden="true" />
            {asOfLabel}
          </span>
        ) : null}
      </div>
      <RankingsNav active={reading} />
    </header>
  )

  if (result.status === 'unavailable') {
    return (
      <div className={styles.page}>
        {head}
        <div className={styles.empty} data-analytics-id={`picks_unavailable:${reading}`}>
          <h2 className={styles.emptyTitle}>This ranking is temporarily unavailable</h2>
          <p className={styles.emptyText}>The latest snapshot did not load. Nothing is wrong with your account.</p>
          <RetryButton analyticsId="picks_unavailable_retry">Retry</RetryButton>
        </div>
      </div>
    )
  }

  if (result.totalRanked === 0) {
    return (
      <div className={styles.page}>
        {head}
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Nothing qualified for this ranking</h2>
          <p className={styles.emptyText}>
            Every tracked name was held back by the data floor or is not a company. That is a data problem, not an
            empty market.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {head}

      <div className={styles.body}>
        <div className={styles.main}>
          {result.items.length > 0 ? (
            <>
              <div className={styles.grid}>
                {result.items.map((item, index) => (
                  <PickCard key={item.symbol} item={item} rank={index + 1} index={index} showCapital={reading === 'income'} />
                ))}
              </div>
              <p className={styles.caveat}>{PICK_SCORE_CAVEAT}</p>
            </>
          ) : null}

          <PickLockedRows lockedCount={result.lockedCount} totalRanked={result.totalRanked} tier={result.tier} />
        </div>

        <PickReadingRail reading={reading} filters={result.filters} />
      </div>

      <PickDisclosure asOfLabel={asOfLabel} />
    </div>
  )
}
