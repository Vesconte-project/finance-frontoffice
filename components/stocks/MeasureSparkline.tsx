import styles from './ResearchViews.module.css'

/**
 * The series behind a measure, drawn server-side as plain SVG.
 *
 * Deliberately not `TemporalLineChart`: that one carries axes, ticks, a hover
 * crosshair and a tooltip, and is a client component. Here the shape is the
 * whole point — the exact values live in the card above it and in the
 * Financials view — so this stays static markup with no runtime cost.
 */
export default function MeasureSparkline({
  values,
  ariaLabel,
}: {
  values: number[]
  ariaLabel: string
}) {
  if (values.length < 2) return null

  const width = 100
  const height = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const step = width / (values.length - 1)
  // A flat series has no range to normalise against; draw it down the middle
  // rather than dividing by zero or pinning it to an edge.
  const y = (value: number) => (span === 0 ? height / 2 : height - ((value - min) / span) * height)
  const points = values.map((value, index) => `${(index * step).toFixed(2)},${y(value).toFixed(2)}`)
  const last = values[values.length - 1]

  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <polyline points={points.join(' ')} vectorEffect="non-scaling-stroke" />
      {/* The viewBox is stretched to the card's width, so a circle would render
          as an ellipse. A zero-length round-capped stroke is a true dot at any
          aspect ratio. */}
      <line
        className={styles.sparklineHead}
        x1={width}
        y1={y(last)}
        x2={width}
        y2={y(last)}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
