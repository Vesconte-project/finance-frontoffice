import type { CSSProperties, ReactNode } from 'react'
import { labelPosition, type LabelAnchor, type PlotBox } from '@/lib/chart-labels'
import styles from './ChartFrame.module.css'

/**
 * A research chart that chooses its drawing by the space it has.
 *
 * A chart may provide a `wide` and a `compact` plot. The frame shows the compact
 * one while it is narrower than 32.5rem (520px) and the wide one otherwise —
 * measured on the frame itself, so a chart in a narrow column of a wide window
 * gets the compact drawing too. A chart that reads well at every width passes a
 * single plot with `variant="any"`.
 */
export default function ChartFrame({
  ariaLabel,
  children,
  className,
}: {
  /** What the chart shows, for readers who cannot see it. */
  ariaLabel: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={className ? `${styles.frame} ${className}` : styles.frame} aria-label={ariaLabel} data-chart-frame>
      {children}
    </figure>
  )
}

/**
 * One drawing of the chart. The SVG uses `box` as its coordinate space and
 * stretches to the frame; strokes keep their width. Labels are page text laid
 * over the drawing with `ChartLabel`, so they keep their size and never scale.
 */
export function ChartPlot({
  box,
  variant = 'any',
  labels,
  children,
}: {
  box: PlotBox
  variant?: 'wide' | 'compact' | 'any'
  /** `ChartLabel`s, positioned in the same coordinates as the drawing. */
  labels?: ReactNode
  /** SVG content (paths, rects…), drawn in `box` coordinates. */
  children: ReactNode
}) {
  return (
    <div
      className={styles.plot}
      data-chart-variant={variant}
      style={{ aspectRatio: `${box.width} / ${box.height}` } as CSSProperties}
    >
      <svg
        className={styles.drawing}
        viewBox={`0 0 ${box.width} ${box.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
      {labels ? <div className={styles.labels}>{labels}</div> : null}
    </div>
  )
}

/** A name or number written on the chart, pinned to plot coordinates. */
export function ChartLabel({
  box,
  x,
  y,
  anchor = 'middle',
  baseline = 'middle',
  tone,
  strong = false,
  children,
}: {
  box: PlotBox
  x: number
  y: number
  anchor?: LabelAnchor
  baseline?: LabelAnchor
  tone?: 'up' | 'down' | 'muted' | 'accent'
  strong?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={styles.label}
      data-chart-label
      data-tone={tone}
      data-strong={strong ? 'true' : undefined}
      style={labelPosition(box, x, y, anchor, baseline)}
    >
      {children}
    </span>
  )
}
