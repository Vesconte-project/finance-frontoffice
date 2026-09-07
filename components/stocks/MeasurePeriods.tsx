import styles from './ResearchViews.module.css'

/**
 * The reported periods behind a measure: a column per period, labelled with
 * its fiscal year and its value.
 *
 * Not a sparkline. This contract returns a handful of annual periods — four
 * for Apple — and a line normalised to its own min and max turned a 9% dip
 * into a cliff while showing neither the years nor the figures. Columns from
 * a zero baseline read honestly at that length: when four years of revenue
 * barely move, the columns barely move, which is the finding.
 */
export default function MeasurePeriods({
  points,
  format,
}: {
  points: Array<{ label: string; value: number; display: string }>
  format: 'currency' | 'perShare' | 'shares' | 'number'
}) {
  if (points.length === 0) return null
  // Heights come from magnitude so a reported outflow — dividends paid are
  // negative in the cash-flow statement — still draws a column; the sign stays
  // on the printed figure, and the bar is marked so it does not read as income.
  const peak = Math.max(...points.map((point) => Math.abs(point.value)), 0)

  return (
    <ol className={styles.periods} data-format={format}>
      {points.map((point, index) => (
        <li key={point.label} data-latest={index === points.length - 1 || undefined}>
          <span className={styles.periodTrack} aria-hidden="true">
            <i
              style={{ height: `${peak === 0 ? 0 : (Math.abs(point.value) / peak) * 100}%` }}
              data-negative={point.value < 0 || undefined}
            />
          </span>
          <span className={styles.periodValue}>{point.display}</span>
          <span className={styles.periodLabel}>{point.label}</span>
        </li>
      ))}
    </ol>
  )
}
