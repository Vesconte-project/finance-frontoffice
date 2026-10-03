'use client'

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import ChartContainer from '@/components/charts/ChartContainer'
import { formatMoney } from '@/lib/currency'
import { cn } from '@/lib/utils'
import styles from './TemporalLineChart.module.css'

export type TemporalLinePoint = {
  date: string
  value: number
  key?: string
  tooltipMeta?: string | null
}

export type TemporalValueFormat = 'currency' | 'multiple' | 'number'

type XTick = { index: number; label: string }

function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', ...options,
  })
}

function parseChartDate(value: string): number {
  return new Date(`${value}T00:00:00Z`).getTime()
}

function thinTicks(ticks: XTick[], max: number): XTick[] {
  if (ticks.length <= max) return ticks
  const step = Math.ceil(ticks.length / max)
  return ticks.filter((_, position) => position % step === 0)
}

type PlacedXLabel = { key: string; x: number; label: string }

/**
 * Positions date labels inside the plot and drops any that would collide. The
 * first and last labels take priority, so the visible range is always named.
 */
function placeXLabels(
  ticks: XTick[],
  renderedPoints: Array<{ date: string; x: number }>,
  plotLeft: number,
  plotWidth: number,
): PlacedXLabel[] {
  // Approximate half-width of a 12px label; it keeps every label inside the plot.
  const halfWidth = (label: string) => Math.min(plotWidth / 2, label.length * 3 + 2)
  const placed = ticks.flatMap(({ index, label }) => {
    const point = renderedPoints[index]
    if (!point) return []
    const half = halfWidth(label)
    const x = Math.max(plotLeft + half, Math.min(plotLeft + plotWidth - half, point.x))
    return [{ key: `${point.date}-${index}`, x, label, left: x - half, right: x + half }]
  })
  const minimumGap = 8
  const kept: typeof placed = []
  placed.forEach((candidate, position) => {
    const previous = kept.at(-1)
    if (!previous || candidate.left >= previous.right + minimumGap) {
      kept.push(candidate)
      return
    }
    // The last label replaces a colliding middle label, never the first one.
    if (position === placed.length - 1 && kept.length > 1) {
      kept.pop()
      const beforeLast = kept.at(-1)
      if (!beforeLast || candidate.left >= beforeLast.right + minimumGap) kept.push(candidate)
    }
  })
  return kept.map(({ key, x, label }) => ({ key, x, label }))
}

function buildXTicks(dates: string[], maxTicks = 6): XTick[] {
  const total = dates.length
  if (total === 0) return []
  if (total === 1) return [{ index: 0, label: formatDate(dates[0], { month: 'short', day: 'numeric' }) }]

  const spanDays = (parseChartDate(dates[total - 1]) - parseChartDate(dates[0])) / 86_400_000
  if (spanDays > 700) {
    const ticks: XTick[] = []
    let previousYear: number | null = null
    dates.forEach((date, index) => {
      const year = new Date(`${date}T00:00:00Z`).getUTCFullYear()
      if (previousYear !== null && year !== previousYear) ticks.push({ index, label: String(year) })
      previousYear = year
    })
    return thinTicks(ticks, maxTicks)
  }

  if (spanDays > 45) {
    const ticks: XTick[] = []
    let previousMonth: number | null = null
    dates.forEach((date, index) => {
      const parsed = new Date(`${date}T00:00:00Z`)
      const monthKey = parsed.getUTCFullYear() * 12 + parsed.getUTCMonth()
      if (previousMonth !== null && monthKey !== previousMonth) {
        ticks.push({
          index,
          label: parsed.getUTCMonth() === 0
            ? String(parsed.getUTCFullYear())
            : parsed.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        })
      }
      previousMonth = monthKey
    })
    return thinTicks(ticks, maxTicks)
  }

  const count = Math.min(maxTicks, total)
  const ticks: XTick[] = []
  for (let position = 0; position < count; position++) {
    const index = Math.round((position / Math.max(1, count - 1)) * (total - 1))
    if (!ticks.some((tick) => tick.index === index)) {
      ticks.push({ index, label: formatDate(dates[index], { month: 'short', day: 'numeric' }) })
    }
  }
  return ticks
}

function formatRangeChange(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatChartValue(value: number, valueFormat: TemporalValueFormat, currency: string): string {
  if (valueFormat === 'currency') return formatMoney(value, currency)
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
  return valueFormat === 'multiple' ? `${formatted}x` : formatted
}

export default function TemporalLineChart({
  points,
  ariaLabel,
  className,
  emptyState,
  valueFormat = 'number',
  currency = 'USD',
  showRangeChange = false,
}: {
  points: TemporalLinePoint[]
  ariaLabel: string
  className?: string
  emptyState?: ReactNode
  valueFormat?: TemporalValueFormat
  currency?: string
  showRangeChange?: boolean
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  // A touch reading has no hover to end it, so it stays until a tap elsewhere.
  const [touchReading, setTouchReading] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!touchReading) return
    const dismiss = (event: globalThis.PointerEvent) => {
      if (canvasRef.current?.contains(event.target as Node)) return
      setHoverIndex(null)
      setTouchReading(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [touchReading])

  // Mouse hover, a tap, or a horizontal drag on touch all read the nearest point.
  const readPoint = (event: PointerEvent<SVGRectElement>, count: number, innerWidth: number) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / innerWidth))
    setHoverIndex(Math.round(ratio * Math.max(0, count - 1)))
    if (event.pointerType !== 'mouse') setTouchReading(true)
  }

  return (
    <ChartContainer className={cn(styles.chart, points.length === 0 && styles.emptyChart, className)} loadingText="Loading chart...">
      {({ width, height }) => {
        if (points.length === 0) {
          return <div className={styles.emptyState} data-chart-state="empty">{emptyState ?? 'Temporal data is unavailable.'}</div>
        }

        const padding = { top: 12, right: 58, bottom: 24, left: 6 }
        const innerWidth = Math.max(1, width - padding.left - padding.right)
        const innerHeight = Math.max(1, height - padding.top - padding.bottom)
        const values = points.map((point) => point.value)
        const min = Math.min(...values)
        const max = Math.max(...values)
        const spread = max - min || Math.max(1, Math.abs(min) * 0.03)
        const floor = min - spread * 0.08
        const ceiling = max + spread * 0.08
        const renderedPoints = points.map((point, index) => ({
          ...point,
          x: padding.left + (index / Math.max(1, points.length - 1)) * innerWidth,
          y: padding.top + (1 - (point.value - floor) / (ceiling - floor)) * innerHeight,
        }))
        const linePath = renderedPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
        const areaPath = `${linePath} L${renderedPoints.at(-1)?.x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)} L${renderedPoints[0]?.x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)} Z`
        // Each date label needs roughly 96px; fit as many as the plot width holds.
        const xTickLimit = Math.max(2, Math.min(6, Math.floor(innerWidth / 96) + 1))
        const xTicks = buildXTicks(points.map((point) => point.date), xTickLimit)
        const xLabels = placeXLabels(xTicks, renderedPoints, padding.left, innerWidth)
        const yTicks = Array.from({ length: 5 }, (_, index) => floor + ((ceiling - floor) / 4) * index)
        const hoverPoint = hoverIndex === null ? null : renderedPoints[hoverIndex] ?? null
        const tooltipLeft = hoverPoint ? Math.min(width - 156, Math.max(8, hoverPoint.x + 14)) : 0
        const tooltipTop = hoverPoint ? Math.max(8, Math.min(height - 100, hoverPoint.y - 82)) : 0
        const firstRenderedPoint = renderedPoints[0] ?? null
        const rangeBaseValue = firstRenderedPoint?.value ?? null
        const rangeChange = hoverPoint && rangeBaseValue !== null && rangeBaseValue !== 0
          ? ((hoverPoint.value - rangeBaseValue) / Math.abs(rangeBaseValue)) * 100
          : null
        const chartKey = `${points.length}:${points[0]?.key ?? points[0]?.date ?? ''}:${points.at(-1)?.key ?? points.at(-1)?.date ?? ''}`

        return (
          <div ref={canvasRef} className={styles.canvas} data-chart-state="available" data-temporal-line-chart="">
            <svg width={width} height={height} className={styles.svg} role="img" aria-label={ariaLabel}>
              {yTicks.map((tick) => {
                const y = padding.top + (1 - (tick - floor) / (ceiling - floor)) * innerHeight
                return <line key={tick} x1={padding.left} y1={y} x2={padding.left + innerWidth} y2={y} className={styles.gridLine} />
              })}

              <path key={`area-${chartKey}`} className={styles.area} d={areaPath} />
              <path key={`line-${chartKey}`} className={styles.line} d={linePath} pathLength={1} />
{hoverPoint ? (
                <>
                  <g className={styles.crosshair} style={{ transform: `translateX(${hoverPoint.x}px)` }}>
                    <line x1={0} y1={padding.top} x2={0} y2={padding.top + innerHeight} stroke="var(--text)" strokeWidth="1.4" />
                  </g>
                  <g className={styles.hoverDot} style={{ transform: `translate(${hoverPoint.x}px, ${hoverPoint.y}px)` }}>
                    <circle r="9" fill="var(--color-accent)" opacity="0.16" />
                    <circle r="4.2" fill="var(--color-accent)" stroke="var(--bg-surface)" strokeWidth="2" />
                  </g>
                </>
              ) : null}

              {xLabels.map(({ key, x, label }) => (
                <text key={key} x={x} y={height - 4} textAnchor="middle" className={styles.axisLabel}>{label}</text>
              ))}

              {yTicks.map((tick) => {
                const y = padding.top + (1 - (tick - floor) / (ceiling - floor)) * innerHeight
                return <text key={`y-${tick}`} x={width - 4} y={y + 4} textAnchor="end" className={styles.axisValue}>{formatChartValue(tick, valueFormat, currency)}</text>
              })}

              <rect
                x={padding.left}
                y={padding.top}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onPointerDown={(event) => readPoint(event, renderedPoints.length, innerWidth)}
                onPointerMove={(event) => readPoint(event, renderedPoints.length, innerWidth)}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setHoverIndex(null)
                }}
                onPointerCancel={() => {
                  // The page took the gesture for a vertical scroll.
                  setHoverIndex(null)
                  setTouchReading(false)
                }}
              />
            </svg>

            {hoverPoint ? (
              <div className={styles.tooltip} data-chart-tooltip="" style={{ left: tooltipLeft, top: tooltipTop }}>
                <div className={styles.tooltipMeta}>{formatDate(hoverPoint.date)}</div>
                <div className={styles.tooltipValue}>{formatChartValue(hoverPoint.value, valueFormat, currency)}</div>
                {showRangeChange && rangeChange !== null && firstRenderedPoint ? (
                  <div className={cn(styles.tooltipChange, rangeChange > 0 ? styles.positive : rangeChange < 0 ? styles.negative : styles.neutral)}>
                    {formatRangeChange(rangeChange)} <span>since {formatDate(firstRenderedPoint.date)}</span>
                  </div>
                ) : null}
                {hoverPoint.tooltipMeta ? <div className={styles.tooltipMeta}>{hoverPoint.tooltipMeta}</div> : null}
              </div>
            ) : null}
          </div>
        )
      }}
    </ChartContainer>
  )
}
