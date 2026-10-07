import 'server-only'

import Link from 'next/link'
import { resolveVisiblePicks, type VisiblePicks } from '@/lib/picks-access'
import {
  PICK_READING_CONTENT,
  PICK_READING_KEYS,
  PICK_READING_TO_SLUG,
  PICK_DISCLOSURE,
  PICK_SCORE_CAVEAT,
  formatSnapshotDate,
  type PickReadingKey,
} from '@/lib/picks-content'
import styles from './HomeBoard.module.css'

export type HomeBoardData = Record<PickReadingKey, VisiblePicks>

export async function loadHomeBoardData(): Promise<HomeBoardData> {
  const [longTerm, income, shortTerm] = await Promise.all([
    resolveVisiblePicks('longTerm'),
    resolveVisiblePicks('income'),
    resolveVisiblePicks('shortTerm'),
  ])

  return { longTerm, income, shortTerm }
}

export function homeBoardHasData(data: HomeBoardData): boolean {
  return PICK_READING_KEYS.some((key) => {
    const result = data[key]
    return result.status === 'ok' && result.totalRanked > 0
  })
}

function ReadingColumn({ reading, result }: { reading: PickReadingKey; result: VisiblePicks }) {
  const content = PICK_READING_CONTENT[reading]
  const readingHref = `/picks/${PICK_READING_TO_SLUG[reading]}`
  const stateMessage = result.status === 'unavailable'
    ? 'Temporarily unavailable.'
    : result.totalRanked === 0
      ? 'Nothing qualified today.'
      : null

  return (
    <section className={styles.column} aria-labelledby={`home-board-${reading}`}>
      <header className={styles.columnHeader}>
        <Link id={`home-board-${reading}`} href={readingHref} className={styles.readingLink}>
          {content.label}
        </Link>
        <p className={styles.reader}>{content.reader}</p>
      </header>

      {stateMessage ? (
        <p className={styles.state}>{stateMessage}</p>
      ) : result.status === 'ok' && result.items.length === 0 ? (
        // Below Pro the tier cut sends a count and no names; say so rather than
        // leaving an empty column.
        <p className={styles.state} data-home-board-locked="">
          <span className="numeric-tabular">{result.totalRanked}</span> companies ranked.{' '}
          <Link href={readingHref} className={styles.caveatLink}>The current order is part of a paid plan.</Link>
        </p>
      ) : result.status === 'ok' ? (
        <div className={styles.rows}>
          {/* Homepage presentation cap, not an entitlement cut. */}
          {result.items.slice(0, 5).map((item, index) => {
            const rank = index + 1
            return (
              <Link
                key={item.symbol}
                href={`/stocks/${encodeURIComponent(item.symbol)}`}
                className={styles.row}
                aria-label={`${rank}. ${item.name ? `${item.name}, ` : ''}${item.symbol}, score ${item.score}`}
              >
                <span className={`${styles.rank} numeric-tabular`}>{rank}</span>
                <span className={`${styles.symbol} numeric-tabular`}>{item.symbol}</span>
                {item.name ? <span className={styles.company}>{item.name}</span> : null}
                <span className={`${styles.score} numeric-tabular`}>{item.score}</span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

export default async function HomeBoard({ data }: { data: HomeBoardData }) {
  if (!homeBoardHasData(data)) return null

  const datedResult = PICK_READING_KEYS
    .map((key) => data[key])
    .find((result) => result.status === 'ok' && result.asOf)
  const asOf = datedResult?.status === 'ok' ? datedResult.asOf : null
  const asOfLabel = formatSnapshotDate(asOf)
  const showsNames = PICK_READING_KEYS.some((key) => {
    const result = data[key]
    return result.status === 'ok' && result.items.length > 0
  })

  return (
    <section className={styles.section} aria-labelledby="home-board-heading" data-home-board="">
      <div className={styles.container}>
        <div className={styles.panel}>
          <header className={styles.panelHeader}>
            <h2 id="home-board-heading" className={styles.heading}>Today&apos;s board</h2>
            {asOf && asOfLabel ? (
              <time className={`${styles.snapshot} numeric-tabular`} dateTime={asOf}>{asOfLabel}</time>
            ) : null}
          </header>

          <div className={styles.columns} data-chrome-collision="">
            {PICK_READING_KEYS.map((reading) => (
              <ReadingColumn key={reading} reading={reading} result={data[reading]} />
            ))}
          </div>
        </div>

        <p className={styles.caveat}>
          Free to everyone:{' '}
          <Link href="/picks/weekly" className={styles.caveatLink} data-analytics-id="home_board_weekly">
            this week&apos;s ranking
          </Link>
          , and where any single company stands on its own page.
        </p>
        {showsNames ? (
          <>
            <p className={styles.caveat}>{PICK_SCORE_CAVEAT}</p>
            <p className={styles.caveat} data-pick-disclosure="">
              {PICK_DISCLOSURE.producer} {PICK_DISCLOSURE.general} {PICK_DISCLOSURE.risk}{' '}
              <Link href="/product#methodology" className={styles.caveatLink}>Methodology</Link>
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
