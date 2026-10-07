import RetryButton from '@/components/ui/RetryButton'
import PickCard from '@/components/picks/PickCard'
import PickDisclosure from '@/components/picks/PickDisclosure'
import PickLockedRows from '@/components/picks/PickLockedRows'
import PickReadingRail from '@/components/picks/PickReadingRail'
import { RankingsHeader, RankingsStage } from '@/components/picks/RankingsChrome'
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
    <RankingsHeader
      eyebrow="Rankings"
      title={content.label}
      subtitle={content.subtitle}
      stamp={asOfLabel}
      active={reading}
    />
  )

  if (result.status === 'unavailable') {
    return (
      <RankingsStage seed={content.label}>
        {head}
        <div className={styles.empty} data-analytics-id={`picks_unavailable:${reading}`}>
          <h2 className={styles.emptyTitle}>This ranking is temporarily unavailable</h2>
          <p className={styles.emptyText}>The latest snapshot did not load. Nothing is wrong with your account.</p>
          <RetryButton analyticsId="picks_unavailable_retry">Retry</RetryButton>
        </div>
      </RankingsStage>
    )
  }

  if (result.totalRanked === 0) {
    return (
      <RankingsStage seed={content.label}>
        {head}
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Nothing qualified for this ranking</h2>
          <p className={styles.emptyText}>
            Every tracked name was held back by the data floor or is not a company. That is a data problem, not an
            empty market.
          </p>
        </div>
      </RankingsStage>
    )
  }

  return (
    <RankingsStage seed={content.label}>
      {head}

      <div className={styles.body}>
        <div className={styles.main}>
          {result.items.length > 0 ? (
            <>
              <ol className={styles.list} aria-label={`${content.label} ranking`}>
                {result.items.map((item, index) => (
                  <PickCard key={item.symbol} item={item} rank={index + 1} index={index} showCapital={reading === 'income'} />
                ))}
              </ol>
              <p className={styles.caveat}>{PICK_SCORE_CAVEAT}</p>
            </>
          ) : null}

          <PickLockedRows lockedCount={result.lockedCount} totalRanked={result.totalRanked} tier={result.tier} />
        </div>

        <PickReadingRail reading={reading} filters={result.filters} />
      </div>

      <PickDisclosure asOfLabel={asOfLabel} />
    </RankingsStage>
  )
}
