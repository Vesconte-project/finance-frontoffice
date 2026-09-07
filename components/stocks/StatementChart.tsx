'use client'

import { useState } from 'react'
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
 * A statement drawn as what it is: nested quantities, not competing ones.
 *
 * Revenue, gross profit, operating income and net income are not three series
 * side by side — each is contained in the one before it. Drawing them as a
 * grouped bar chart said they were comparable categories, which is why it
 * needed unrelated hues to tell them apart and why none of them ever belonged
 * on the page. Each period is one column that narrows as the money is spent,
 * so the shape of the column answers the question anyone opens an income
 * statement with: how much of what you sold did you keep.
 *
 * Each step also shifts right as it narrows, so it clears the right edge of the
 * one behind it. Concentric bars of a single hue read as one shape however far
 * apart their tints are; a visible edge per step is what separates them.
 *
 * Nothing is computed: every bar is a reported figure, and the steps between
 * them are visible without naming a difference we did not receive.
 */
export default function StatementChart({
  periods,
  series,
  currency,
  caption,
  height = 210,
}: {
  periods: string[]
  series: StatementSeries[]
  currency: string
  caption: string
  height?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const values = series.flatMap((entry) => entry.values).filter((value): value is number => value !== null)
  if (periods.length === 0 || series.length === 0 || values.length === 0) return null

  return (
    <figure className={styles.statementChart}>
      <figcaption>
        <ul className={styles.chartLegend}>
          {series.map((entry, index) => (
            <li key={entry.key} style={{ ['--depth' as string]: String(index) }}>{entry.label}</li>
          ))}
        </ul>
      </figcaption>
      <div className={styles.statementChartPlot} style={{ height }}>
        <ChartContainer>
          {({ width }) => {
            const padding = { top: 10, right: 2, bottom: 26, left: 58 }
            const plotWidth = Math.max(1, width - padding.left - padding.right)
            const plotHeight = Math.max(1, height - padding.top - padding.bottom)

            const top = niceCeiling(Math.max(...values, 0))
            const bottom = -niceCeiling(Math.abs(Math.min(...values, 0)))
            const range = top - bottom || 1
            const y = (value: number) => padding.top + ((top - value) / range) * plotHeight
            const zeroY = y(0)

            const slot = plotWidth / periods.length
            const depths = Math.max(1, series.length - 1)
            const shift = Math.min(9, slot * 0.07)
            const widest = Math.min(58, slot * 0.52)
            const narrowBy = 0.17
            const span = widest + depths * shift
            const ticks = bottom < 0 ? [top, 0, bottom] : [top, top / 2, 0]

            const tipWidth = 168
            const tipLeft = hovered === null
              ? 0
              : Math.min(
                Math.max(padding.left + hovered * slot + slot / 2, tipWidth / 2),
                Math.max(tipWidth / 2, width - tipWidth / 2),
              )

            return (
              <>
              <svg
                width={width}
                height={height}
                role="img"
                aria-label={caption}
                onMouseLeave={() => setHovered(null)}
              >
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
                    <text className={styles.chartTick} x={padding.left - 9} y={y(tick) + 4} textAnchor="end">
                      {tick === 0 ? '0' : formatCompactMoney(tick, currency)}
                    </text>
                  </g>
                ))}
                {periods.map((period, periodIndex) => {
                  const centre = padding.left + periodIndex * slot + slot / 2
                  const outerRight = centre - span / 2 + widest
                  return (
                    <g key={period} data-dimmed={hovered !== null && hovered !== periodIndex || undefined}>
                      {series.map((entry, depth) => {
                        const value = entry.values[periodIndex]
                        if (value === null) return null
                        const barWidth = widest * (1 - depth * narrowBy)
                        const right = outerRight + depth * shift
                        const valueY = y(value)
                        return (
                          <rect
                            key={entry.key}
                            className={styles.chartBar}
                            style={{ ['--depth' as string]: String(depth) }}
                            x={right - barWidth}
                            width={Math.max(2, barWidth)}
                            y={Math.min(valueY, zeroY)}
                            height={Math.max(1, Math.abs(zeroY - valueY))}
                            rx="2"
                          />
                        )
                      })}
                      <text
                        className={styles.chartPeriod}
                        x={centre}
                        y={height - padding.bottom + 18}
                        textAnchor="middle"
                      >
                        {period}
                      </text>
                      {/* The hit target is the whole column, not the marks: a
                          reader should not have to find a 12px bar to read the
                          period it belongs to. */}
                      <rect
                        className={styles.chartHit}
                        x={padding.left + periodIndex * slot}
                        width={slot}
                        y={padding.top}
                        height={plotHeight}
                        onMouseEnter={() => setHovered(periodIndex)}
                      />
                    </g>
                  )
                })}
              </svg>
              {hovered !== null ? (
                <div
                  className={styles.chartTip}
                  role="presentation"
                  style={{ left: tipLeft, width: tipWidth }}
                  onMouseEnter={() => setHovered(hovered)}
                >
                  <strong>{periods[hovered]}</strong>
                  <dl>
                    {series.map((entry, depth) => {
                      const value = entry.values[hovered]
                      if (value === null) return null
                      return (
                        <div key={entry.key} style={{ ['--depth' as string]: String(depth) }}>
                          <dt>{entry.label}</dt>
                          <dd>{formatCompactMoney(value, currency)}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              ) : null}
              </>
            )
          }}
        </ChartContainer>
      </div>
    </figure>
  )
}
