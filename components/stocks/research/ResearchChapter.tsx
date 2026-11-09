import type { CSSProperties, ReactNode } from 'react'
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
  measure,
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
  /**
   * The colour of what the chapter measures (a CSS colour, usually a theme
   * role). It marks the heading and is exposed to the chapter's charts as
   * `--chapter-measure`, so a measure keeps one colour across the page.
   */
  measure?: string
  children: ReactNode
}) {
  const headingId = `${id}-label`
  return (
    <section
      id={id}
      className={styles.chapter}
      data-research-chapter={id}
      data-band={band ? 'true' : undefined}
      data-measure={measure ? 'true' : undefined}
      style={measure ? ({ '--chapter-measure': measure } as CSSProperties) : undefined}
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

/**
 * The chapter's large number. `label` names it above the value at reading size,
 * so the number's meaning is read with it; `context` finishes the sentence.
 */
export function LeadStat({
  value,
  context,
  tone,
  label,
}: {
  value: ReactNode
  context?: ReactNode
  tone?: 'up' | 'down'
  label?: string
}) {
  return (
    <div className={styles.lead} data-lead-stat>
      {label ? <p className={styles.leadLabel}>{label}</p> : null}
      <p className={styles.leadLine}>
        <span className={styles.leadValue} data-tone={tone}>{value}</span>
        {context ? <span className={styles.leadContext}>{context}</span> : null}
      </p>
    </div>
  )
}

/**
 * The quiet line at the foot of a chapter: when its figures were measured and
 * how its chart is drawn. It is there to answer a doubt, not to be read first.
 */
export function ChapterNote({ children }: { children: ReactNode }) {
  return <p className={styles.note} data-chapter-note>{children}</p>
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
