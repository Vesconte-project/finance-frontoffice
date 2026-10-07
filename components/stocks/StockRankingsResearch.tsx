import Link from 'next/link'
import type { CSSProperties } from 'react'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import PickDisclosure from '@/components/picks/PickDisclosure'
import { PICK_READING_CONTENT, PICK_READING_TO_SLUG, formatSnapshotDate } from '@/lib/picks-content'
import { absenceCopy, formatStandingPercent, type TickerReadings } from '@/lib/ticker-readings'
import { readingPartsDetail } from '@/lib/reading-eligibility'
import styles from '@/components/picks/Rankings.module.css'

/** Where the company sits between the bottom (0) and the top (100) of the ranked population. */
function percentileFromBottom(position: number, universeSize: number): number {
  if (universeSize <= 1) return 100
  return Math.round(((universeSize - position) / (universeSize - 1)) * 1000) / 10
}

/**
 * Where one company stands in each ranking. Free to every reader.
 *
 * It answers "where is this one", never "which ones lead": a band (`Top 7%`), the
 * company's place on a bottom-to-top track and its position out of the ranked
 * population. The ordered list itself is the paid ranking.
 */
export default function StockRankingsResearch({
  ticker,
  readings,
}: {
  ticker: string
  readings: TickerReadings | null
}) {
  const asOfLabel = formatSnapshotDate(readings?.asOf ?? null)

  return (
    <div data-research-view="" data-ticker-rankings="">
      <ResearchChapter id="standings" label={`Where ${ticker} stands`} aside={<PickDisclosure asOfLabel={asOfLabel} />}>
        {readings ? (
          <div className={styles.standings}>
            {readings.readings.map((item, index) => {
              const content = PICK_READING_CONTENT[item.reading]
              const href = `/picks/${PICK_READING_TO_SLUG[item.reading]}`
              const ranked = item.status === 'ranked'
              const p = ranked ? percentileFromBottom(item.standing.position, item.standing.universeSize) : 0
              const detail =
                item.status === 'absent' && item.absenceReason === 'insufficient_coverage'
                  ? readingPartsDetail(item.measuredParts, item.missingParts)
                  : null

              return (
                <article
                  key={item.reading}
                  className={styles.standing}
                  style={{ '--i': index, '--p': `${p}%` } as CSSProperties}
                  data-reading={item.reading}
                >
                  <div className={styles.standingHead}>
                    <span className={styles.standingLabel}>{content.label}</span>
                    <Link href={href} className={styles.standingLink}>
                      The model
                    </Link>
                  </div>

                  {ranked ? (
                    <>
                      <p className={styles.standingValue}>
                        {formatStandingPercent(item.standing.position, item.standing.universeSize)}
                      </p>
                      <div className={styles.percentile}>
                        <div
                          className={styles.percentileTrack}
                          role="img"
                          aria-label={`Position ${item.standing.position} of ${item.standing.universeSize}, counted from the top`}
                        >
                          <span className={styles.percentileFill} />
                          <span className={styles.percentileMarker} />
                        </div>
                        <div className={styles.percentileEnds} aria-hidden="true">
                          <span>Bottom</span>
                          <span>Top</span>
                        </div>
                      </div>
                      <p className={styles.standingMeta}>
                        #{item.standing.position} of {item.standing.universeSize}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={styles.standingAbsent}>{absenceCopy(item.absenceReason)}</p>
                      {detail ? <p className={styles.standingParts}>{detail}</p> : null}
                    </>
                  )}

                  <p className={styles.standingParts}>{content.subtitle}</p>
                </article>
              )
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyText}>Standings for {ticker} are not available right now.</p>
          </div>
        )}
      </ResearchChapter>
    </div>
  )
}
