import 'server-only'

import Link from 'next/link'
import { resolveVisiblePicks, type VisiblePicks } from '@/lib/picks-access'
import {
  PICK_READING_CONTENT,
  PICK_READING_KEYS,
  PICK_READING_TO_SLUG,
  PICK_SCORE_CAVEAT,
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
    return result.status === 'ok' && result.items.length > 0
  })
}

function formatAsOf(asOf: string | null): string | null {
  if (!asOf) return null
  const parsed = new Date(`${asOf}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function ReadingColumn({ reading, result }: { reading: PickReadingKey; result: VisiblePicks }) {
  const content = PICK_READING_CONTENT[reading]
  const readingHref = `/picks/${PICK_READING_TO_SLUG[reading]}`
  const stateMessage = result.status === 'unavailable'
    ? 'Temporarily unavailable.'
    : result.items.length === 0
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
      ) : result.status === 'ok' ? (
        <div className={styles.rows}>
          {result.items.map((item, index) => {
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

      <Link href={readingHref} className={styles.mobileLink}>
        See all ten →
      </Link>
    </section>
  )
}

export default async function HomeBoard({ data }: { data: HomeBoardData }) {
  if (!homeBoardHasData(data)) return null

  const datedResult = PICK_READING_KEYS
    .map((key) => data[key])
    .find((result) => result.status === 'ok' && result.asOf)
  const asOf = datedResult?.status === 'ok' ? datedResult.asOf : null
  const asOfLabel = formatAsOf(asOf)

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

          <div className={styles.columns}>
            {PICK_READING_KEYS.map((reading) => (
              <ReadingColumn key={reading} reading={reading} result={data[reading]} />
            ))}
          </div>
        </div>

        <p className={styles.caveat}>{PICK_SCORE_CAVEAT}</p>
      </div>
    </section>
  )
}
