'use client'

import ChartContainer from '@/components/charts/ChartContainer'
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
 * Measured rather than scaled. The first version was a fixed viewBox at
 * `width: 100%; height: auto`, which on a wide window scaled the whole drawing
 * up uniformly until it stood 600px tall and ran off the screen. It now takes
 * its width from ChartContainer — the primitive the other charts already use —
 * and keeps its own height.
 */
export default function StatementChart({
  periods,
  series,
  currency,
  caption,
  format = 'currency',
  height = 240,
}: {
  periods: string[]
  series: StatementSeries[]
  currency: string
  caption: string
  format?: 'currency' | 'plain'
  height?: number
}) {
  const values = series.flatMap((entry) => entry.values).filter((value): value is number => value !== null)
  if (periods.length === 0 || series.length === 0 || values.length === 0) return null

  const axisValue = (value: number) => (
    format === 'currency'
      ? formatCompactMoney(value, currency)
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
  )

  return (
    <figure className={styles.statementChart}>
      {/* Identity is never colour alone: two or more series get a legend, one
          series gets named outright, and the table below carries every figure
          in text. */}
      <figcaption>
        {series.length > 1 ? (
          <ul className={styles.chartLegend}>
            {series.map((entry, index) => <li key={entry.key} data-series={index}>{entry.label}</li>)}
          </ul>
        ) : (
          <span className={styles.chartTitle}>{series[0].label}</span>
        )}
      </figcaption>
      <div className={styles.statementChartPlot} style={{ height }}>
        <ChartContainer>
          {({ width }) => {
            const padding = { top: 12, right: 4, bottom: 30, left: 68 }
            const plotWidth = Math.max(1, width - padding.left - padding.right)
            const plotHeight = Math.max(1, height - padding.top - padding.bottom)

            const top = niceCeiling(Math.max(...values, 0))
            const bottom = -niceCeiling(Math.abs(Math.min(...values, 0)))
            const range = top - bottom || 1
            const y = (value: number) => padding.top + ((top - value) / range) * plotHeight
            const zeroY = y(0)

            const groupWidth = plotWidth / periods.length
            // A 2px surface gap between adjacent bars, and never so wide that
            // three periods read as three walls.
            const barWidth = Math.min(34, (groupWidth * 0.66) / series.length)
            const groupInset = (groupWidth - barWidth * series.length) / 2
            const ticks = bottom < 0 ? [top, 0, bottom] : [top, top / 2, 0]

            return (
              <svg width={width} height={height} role="img" aria-label={caption}>
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
                    <text className={styles.chartTick} x={padding.left - 10} y={y(tick) + 4} textAnchor="end">
                      {tick === 0 ? '0' : axisValue(tick)}
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
                        const valueY = y(value)
                        return (
                          <rect
                            key={entry.key}
                            className={styles.chartBar}
                            data-series={seriesIndex}
                            x={groupX + groupInset + seriesIndex * barWidth + 1}
                            width={Math.max(1, barWidth - 2)}
                            y={Math.min(valueY, zeroY)}
                            height={Math.max(1, Math.abs(zeroY - valueY))}
                            rx="2"
                          >
                            <title>{`${entry.label} · ${period} · ${axisValue(value)}`}</title>
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
            )
          }}
        </ChartContainer>
      </div>
    </figure>
  )
}
