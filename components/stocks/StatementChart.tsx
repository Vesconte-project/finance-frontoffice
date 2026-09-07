import { formatCompactMoney } from '@/lib/currency'
import styles from './ResearchViews.module.css'

export type StatementSeries = {
  key: string
  label: string
  values: Array<number | null>
}

function niceCeiling(value: number): number {
  if (value <= 0) return 0
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

/**
 * The money lines of a statement, over the periods it was reported for.
 *
 * Grouped columns rather than a shape: here the comparison between series is
 * the information — revenue against what was left of it — and unlike a single
 * measure's near-flat history, those magnitudes genuinely differ. Drawn on the
 * server as plain SVG, so the page stays static.
 */
export default function StatementChart({
  periods,
  series,
  currency,
  caption,
}: {
  periods: string[]
  series: StatementSeries[]
  currency: string
  caption: string
}) {
  const values = series.flatMap((entry) => entry.values).filter((value): value is number => value !== null)
  if (periods.length === 0 || series.length === 0 || values.length === 0) return null

  const width = 760
  const height = 260
  const padding = { top: 14, right: 8, bottom: 42, left: 74 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const top = niceCeiling(Math.max(...values, 0))
  const bottom = -niceCeiling(Math.abs(Math.min(...values, 0)))
  const range = top - bottom || 1
  const y = (value: number) => padding.top + ((top - value) / range) * plotHeight
  const zeroY = y(0)

  const groupWidth = plotWidth / periods.length
  const barWidth = Math.min(38, (groupWidth * 0.72) / series.length)
  const groupInset = (groupWidth - barWidth * series.length) / 2

  const ticks = bottom < 0 ? [top, 0, bottom] : [top, top / 2, 0]

  return (
    <figure className={styles.statementChart}>
      <figcaption>
        <ul className={styles.chartLegend}>
          {series.map((entry, index) => (
            <li key={entry.key} data-series={index}>{entry.label}</li>
          ))}
        </ul>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption} preserveAspectRatio="xMidYMid meet">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className={styles.chartGrid}
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              data-zero={tick === 0 || undefined}
            />
            <text className={styles.chartTick} x={padding.left - 10} y={y(tick) + 3} textAnchor="end">
              {tick === 0 ? '0' : formatCompactMoney(tick, currency)}
            </text>
          </g>
        ))}
        {periods.map((period, periodIndex) => {
          const groupX = padding.left + periodIndex * groupWidth
          return (
            <g key={period}>
              {series.map((entry, seriesIndex) => {
                const value = entry.values[periodIndex]
                if (value === null) return null
                const barX = groupX + groupInset + seriesIndex * barWidth
                const valueY = y(value)
                return (
                  <rect
                    key={entry.key}
                    className={styles.chartBar}
                    data-series={seriesIndex}
                    x={barX + 1}
                    width={Math.max(1, barWidth - 2)}
                    y={Math.min(valueY, zeroY)}
                    height={Math.max(1, Math.abs(zeroY - valueY))}
                  >
                    <title>{`${entry.label} · ${period} · ${formatCompactMoney(value, currency)}`}</title>
                  </rect>
                )
              })}
              <text
                className={styles.chartPeriod}
                x={groupX + groupWidth / 2}
                y={height - padding.bottom + 20}
                textAnchor="middle"
              >
                {period}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
