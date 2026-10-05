import styles from './MiniBars.module.css'

export type MiniBar = {
  key: string
  value: number
}

/**
 * Small bars for a summary card (Spec PRD-78, Overview "Fundamentals"): ten
 * years from a zero line, negatives below it, the last year highlighted, and
 * the first and last years written under the ends.
 */
export default function MiniBars({
  bars,
  firstLabel,
  lastLabel,
  ariaLabel,
}: {
  bars: readonly MiniBar[]
  firstLabel: string
  lastLabel: string
  ariaLabel: string
}) {
  const high = Math.max(0, ...bars.map((bar) => bar.value))
  const low = Math.min(0, ...bars.map((bar) => bar.value))
  const span = high - low || 1
  const width = 100
  const height = 56
  const zeroY = (high / span) * height
  const slot = width / Math.max(1, bars.length)
  const barWidth = slot * 0.72
  return (
    <figure className={styles.frame} aria-label={ariaLabel} role="img">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={styles.plot} aria-hidden="true">
        {bars.map((bar, index) => {
          const top = bar.value >= 0 ? zeroY - (bar.value / span) * height : zeroY
          const size = Math.max(0.6, (Math.abs(bar.value) / span) * height)
          return (
            <rect
              key={bar.key}
              className={styles.bar}
              data-last={index === bars.length - 1 ? 'true' : undefined}
              data-negative={bar.value < 0 ? 'true' : undefined}
              x={slot * index + (slot - barWidth) / 2}
              y={top}
              width={barWidth}
              height={size}
            />
          )
        })}
        <line className={styles.zero} x1={0} x2={width} y1={zeroY} y2={zeroY} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className={styles.axis} aria-hidden="true">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </figcaption>
    </figure>
  )
}
