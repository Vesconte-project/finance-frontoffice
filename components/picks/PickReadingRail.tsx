import type { CSSProperties } from 'react'
import { PICK_READING_CONTENT, type PickReadingKey } from '@/lib/picks-content'
import type { PickFilters } from '@/lib/picks'
import { eligibilitySentence } from '@/lib/reading-eligibility'
import styles from './Rankings.module.css'

/**
 * "How it's read": what the reading weighs, drawn as one bar, and what it ignores.
 *
 * The backend reports its filters in the payload rather than only applying them, so a
 * reader looking at part of the market can be told what happened to the rest. That
 * sits one tap away instead of in the reader's path.
 */
export default function PickReadingRail({
  reading,
  filters,
}: {
  reading: PickReadingKey
  filters: PickFilters
}) {
  const content = PICK_READING_CONTENT[reading]
  // Income's parts carry no fixed weights; they are drawn as equal and say so.
  const shares = content.measures.map((measure) => (measure.weight ? Number.parseFloat(measure.weight) : 1))

  const coverage = filters.eligibility
    ? eligibilitySentence(filters.eligibility)
    : filters.minCoverage > 0
      ? `A reading built from less than ${Math.round(filters.minCoverage * 100)}% of its parts is not ranked.`
      : 'A reading built from too little of its data is not ranked.'

  return (
    <aside className={styles.panel} aria-labelledby="reading-panel-title">
      <h2 id="reading-panel-title" className={styles.panelTitle}>How it&apos;s read</h2>

      <div className={styles.weights} aria-hidden="true">
        {shares.map((share, index) => (
          <span key={content.measures[index]!.label} className={styles.weight} style={{ '--share': share, '--i': index } as CSSProperties} />
        ))}
      </div>

      <ul className={styles.legend}>
        {content.measures.map((measure) => (
          <li key={measure.label} className={styles.legendItem}>
            <span className={styles.swatch} aria-hidden="true" />
            <span className={styles.legendLabel}>{measure.label}</span>
            <span className={styles.legendWeight}>{measure.weight ?? '—'}</span>
            <span className={styles.legendDetail}>{measure.detail}</span>
          </li>
        ))}
      </ul>

      <p className={styles.ignores}>
        Ignores <strong>{content.ignores.toLowerCase()}</strong>.
      </p>

      <details className={styles.fold}>
        <summary>What&apos;s left out</summary>
        <div className={styles.foldBody}>
          <p>{coverage}</p>
          <p>Funds and ETFs are not ranked as companies.</p>
          {content.note ? <p>{content.note}</p> : null}
        </div>
      </details>
    </aside>
  )
}
