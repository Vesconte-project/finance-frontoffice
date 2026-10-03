import type { CSSProperties } from 'react'
import { formatSignedPercent, formatSpan, type Measurement } from '@/lib/chart-measure'
import { cn } from '@/lib/utils'
import styles from './MeasureSummary.module.css'

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDate(date: string): string {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`))
}

/** One sentence for screen readers; the visible bar shows the same facts. */
export function describeMeasurement(measurement: Measurement, formatChange: (value: number) => string): string {
  const percent = measurement.percent === null ? '' : ` (${formatSignedPercent(measurement.percent)})`
  return `From ${formatDate(measurement.from.date)} to ${formatDate(measurement.to.date)}: ${formatChange(measurement.change)}${percent}, ${formatSpan(measurement)}.`
}

/**
 * The bar shown over a chart after a reader measures between two days:
 * price change and percentage, coloured by direction, the time between them
 * and the two dates.
 */
export default function MeasureSummary({
  measurement,
  formatChange,
  className,
  style,
  inline = false,
}: {
  measurement: Measurement
  formatChange: (value: number) => string
  className?: string
  style?: CSSProperties
  /** One line, for a legend row above a chart rather than a box over it. */
  inline?: boolean
}) {
  const tone = measurement.direction === 'up' ? styles.up : measurement.direction === 'down' ? styles.down : styles.flat
  return (
    <div className={cn(inline ? styles.inline : styles.summary, className)} style={style} data-measure-summary="">
      <div className={cn(styles.change, tone)}>
        {formatChange(measurement.change)}
        {measurement.percent !== null ? <span> ({formatSignedPercent(measurement.percent)})</span> : null}
      </div>
      <div className={styles.meta}>{formatSpan(measurement)}</div>
      <div className={styles.meta}>
        {formatDate(measurement.from.date)} → {formatDate(measurement.to.date)}
      </div>
    </div>
  )
}
