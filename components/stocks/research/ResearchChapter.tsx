import type { ReactNode } from 'react'
import styles from './ResearchChapter.module.css'

/**
 * One chapter of a ticker research view: a short label, the chart that tells the
 * story, and the detail beside it.
 *
 * The chapter responds to the space it is given, not to the device: the detail
 * column sits beside the chart (and stays in view while the chart scrolls) when
 * the chapter is wide enough, becomes a grid of cards under the chart at medium
 * widths, and stacks under it when narrow. `band` alternates the background so
 * consecutive chapters separate without rules.
 */
export default function ResearchChapter({
  id,
  label,
  lead,
  aside,
  band = false,
  actions,
  children,
}: {
  /** Anchor for the chapter; also names its heading. */
  id: string
  /** Short subject label, never a question. */
  label: string
  /** The chapter's one large number, usually a `LeadStat`. */
  lead?: ReactNode
  /** Detail shown beside the chart: cards with the "why". */
  aside?: ReactNode
  band?: boolean
  /** Chapter-level controls, such as a period or unit selector. */
  actions?: ReactNode
  children: ReactNode
}) {
  const headingId = `${id}-label`
  return (
    <section
      id={id}
      className={styles.chapter}
      data-research-chapter={id}
      data-band={band ? 'true' : undefined}
      aria-labelledby={headingId}
    >
      <div className={styles.frame}>
        <header className={styles.head}>
          <h2 id={headingId} className={styles.label}>{label}</h2>
          {actions ? <div className={styles.actions} data-chapter-actions>{actions}</div> : null}
        </header>
        <div className={styles.grid} data-has-aside={aside ? 'true' : undefined}>
          <div className={styles.main} data-chapter-main>
            {lead}
            {children}
          </div>
          {aside ? <aside className={styles.aside} data-chapter-aside aria-label={`${label}: detail`}>{aside}</aside> : null}
        </div>
      </div>
    </section>
  )
}

/** The chapter's large number and the short line that says what it is. */
export function LeadStat({ value, context, tone }: { value: ReactNode; context?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <p className={styles.lead} data-lead-stat>
      <span className={styles.leadValue} data-tone={tone}>{value}</span>
      {context ? <span className={styles.leadContext}>{context}</span> : null}
    </p>
  )
}

/** A detail card for the chapter's side column. */
export function ChapterCard({ title, meta, children }: { title?: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.card} data-chapter-card>
      {title || meta ? (
        <div className={styles.cardHead}>
          {title ? <h3 className={styles.cardTitle}>{title}</h3> : null}
          {meta ? <span className={styles.cardMeta}>{meta}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
