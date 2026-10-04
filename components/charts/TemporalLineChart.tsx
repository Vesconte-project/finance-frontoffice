'use client'

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import ChartContainer from '@/components/charts/ChartContainer'
import MeasureSummary, { describeMeasurement } from '@/components/charts/MeasureSummary'
import { candleDirection, type CandleDirection } from '@/lib/candles'
import { LONG_PRESS_MS, LONG_PRESS_SLOP_PX, measureBetween, placeReading } from '@/lib/chart-measure'
import { formatMoney, formatSignedMoney } from '@/lib/currency'
import { cn } from '@/lib/utils'
import styles from './TemporalLineChart.module.css'

export type TemporalLinePoint = {
  date: string
  value: number
  key?: string
  tooltipMeta?: string | null
  /** Candle fields, as the backend supplied them; only read in candle mode. */
  open?: number | null
  high?: number | null
  low?: number | null
}

export type TemporalChartMode = 'line' | 'candles'

type MeasureGesture = {
  pointerId: number
  mouse: boolean
  startX: number
  startY: number
  startIndex: number
  active: boolean
  timer: number | null
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
  mode = 'line',
  measurable = false,
  onMeasureActiveChange,
  reservedCorner,
}: {
  points: TemporalLinePoint[]
  ariaLabel: string
  className?: string
  emptyState?: ReactNode
  valueFormat?: TemporalValueFormat
  currency?: string
  showRangeChange?: boolean
  /** Candles read open, high and low from each point. */
  mode?: TemporalChartMode
  /** Press and drag (a held touch on phones) measures between two days. */
  measurable?: boolean
  /** Told when a measurement appears or clears, so nearby controls can step aside. */
  onMeasureActiveChange?: (active: boolean) => void
  /** Top-left area that controls laid over the chart occupy; the reading avoids it. */
  reservedCorner?: { width: number; height: number }
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  // A touch reading has no hover to end it, so it stays until a tap elsewhere.
  const [touchReading, setTouchReading] = useState(false)
  const [measure, setMeasure] = useState<{ first: number; second: number } | null>(null)
  const [measuring, setMeasuring] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<MeasureGesture | null>(null)
  const measuringRef = useRef(false)
  const [readingSize, setReadingSize] = useState({ width: 160, height: 100 })
  const revealId = `reveal-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  // The reading's real size decides where it fits, measured before paint.
  const measureReading = useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    const width = element.offsetWidth
    const height = element.offsetHeight
    setReadingSize((current) => (current.width === width && current.height === height ? current : { width, height }))
  }, [])

  const measureActive = measure !== null
  useEffect(() => {
    onMeasureActiveChange?.(measureActive)
  }, [measureActive, onMeasureActiveChange])

  const clearMeasure = useCallback(() => {
    setMeasure(null)
    setMeasuring(false)
    measuringRef.current = false
  }, [])

  // A new series (another range or mode) invalidates the measured indices.
  const seriesKey = `${mode}:${points.length}:${points[0]?.date ?? ''}:${points.at(-1)?.date ?? ''}`
  const [measuredSeries, setMeasuredSeries] = useState(seriesKey)
  if (measuredSeries !== seriesKey) {
    setMeasuredSeries(seriesKey)
    setMeasure(null)
    setHoverIndex(null)
  }

  useEffect(() => {
    if (!touchReading && !(measure && !measuring)) return
    const dismiss = (event: globalThis.PointerEvent) => {
      if (canvasRef.current?.contains(event.target as Node)) return
      setHoverIndex(null)
      setTouchReading(false)
      clearMeasure()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearMeasure()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [touchReading, measure, measuring, clearMeasure])

  // While a held touch measures, stop the page from scrolling under it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!measurable || !canvas) return
    const holdPage = (event: TouchEvent) => {
      if (measuringRef.current && event.cancelable) event.preventDefault()
    }
    const noMenu = (event: Event) => event.preventDefault()
    canvas.addEventListener('touchmove', holdPage, { passive: false })
    canvas.addEventListener('contextmenu', noMenu)
    return () => {
      canvas.removeEventListener('touchmove', holdPage)
      canvas.removeEventListener('contextmenu', noMenu)
    }
  })

  useEffect(() => () => {
    const timer = gestureRef.current?.timer
    if (timer) window.clearTimeout(timer)
  }, [])

  const indexAt = (event: PointerEvent<SVGRectElement>, count: number, innerWidth: number) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / innerWidth))
    return Math.round(ratio * Math.max(0, count - 1))
  }

  // Mouse hover, a tap, or a horizontal drag on touch all read the nearest point.
  const readPoint = (index: number, pointerType: string) => {
    setHoverIndex(index)
    if (pointerType !== 'mouse') setTouchReading(true)
  }

  const startMeasuring = (gesture: MeasureGesture, element: Element) => {
    gesture.active = true
    measuringRef.current = true
    setMeasuring(true)
    // The held day keeps its reading until the finger moves to another day.
    setHoverIndex(gesture.startIndex)
    // A short buzz confirms the hold where the device supports it.
    if (!gesture.mouse) navigator.vibrate?.(12)
    setMeasure({ first: gesture.startIndex, second: gesture.startIndex })
    try {
      element.setPointerCapture(gesture.pointerId)
    } catch {
      // The pointer may already be gone; the measurement still stands.
    }
  }

  const endGesture = (keep: boolean) => {
    const gesture = gestureRef.current
    if (gesture?.timer) window.clearTimeout(gesture.timer)
    gestureRef.current = null
    if (!gesture?.active) return
    measuringRef.current = false
    setMeasuring(false)
    if (!keep) {
      setMeasure(null)
      return
    }
    setMeasure((current) => (current && current.first !== current.second ? current : null))
    // A hold that never moved reads that one day, like a tap.
    if (!measure || measure.first === measure.second) {
      setHoverIndex(gesture.startIndex)
      setTouchReading(!gesture.mouse)
      return
    }
    setTouchReading(false)
    setHoverIndex(null)
  }

  const formatChange = (value: number) =>
    valueFormat === 'currency'
      ? formatSignedMoney(value, currency)
      : `${value >= 0 ? '+' : '−'}${formatChartValue(Math.abs(value), valueFormat, currency)}`

  return (
    <ChartContainer className={cn(styles.chart, points.length === 0 && styles.emptyChart, className)} loadingText="Loading chart...">
      {({ width, height }) => {
        if (points.length === 0) {
          return <div className={styles.emptyState} data-chart-state="empty">{emptyState ?? 'Temporal data is unavailable.'}</div>
        }

        const candles = mode === 'candles'
        const padding = { top: 12, right: 58, bottom: 24, left: 6 }
        const innerWidth = Math.max(1, width - padding.left - padding.right)
        const innerHeight = Math.max(1, height - padding.top - padding.bottom)
        const lows = points.map((point) => (candles && typeof point.low === 'number' ? point.low : point.value))
        const highs = points.map((point) => (candles && typeof point.high === 'number' ? point.high : point.value))
        const min = Math.min(...lows)
        const max = Math.max(...highs)
        const spread = max - min || Math.max(1, Math.abs(min) * 0.03)
        const floor = min - spread * 0.08
        const ceiling = max + spread * 0.08
        const yOf = (value: number) => padding.top + (1 - (value - floor) / (ceiling - floor)) * innerHeight
        const renderedPoints = points.map((point, index) => ({
          ...point,
          x: padding.left + (index / Math.max(1, points.length - 1)) * innerWidth,
          y: yOf(point.value),
        }))
        const linePath = renderedPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
        const areaPath = `${linePath} L${renderedPoints.at(-1)?.x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)} L${renderedPoints[0]?.x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)} Z`
        // Each date label needs roughly 96px; fit as many as the plot width holds.
        const xTickLimit = Math.max(2, Math.min(6, Math.floor(innerWidth / 96) + 1))
        const xTicks = buildXTicks(points.map((point) => point.date), xTickLimit)
        const xLabels = placeXLabels(xTicks, renderedPoints, padding.left, innerWidth)
        const yTicks = Array.from({ length: 5 }, (_, index) => floor + ((ceiling - floor) / 4) * index)
        // The reading and a measured span never show at once.
        const spanShown = measure !== null && measure.first !== measure.second
        const hoverPoint = hoverIndex === null || spanShown ? null : renderedPoints[hoverIndex] ?? null
        const readingAt = hoverPoint
          ? placeReading(
            hoverPoint,
            readingSize,
            { width, height },
            reservedCorner ? { left: 0, top: 0, ...reservedCorner } : null,
          )
          : null
        const firstRenderedPoint = renderedPoints[0] ?? null
        const rangeBaseValue = firstRenderedPoint?.value ?? null
        const rangeChange = hoverPoint && rangeBaseValue !== null && rangeBaseValue !== 0
          ? ((hoverPoint.value - rangeBaseValue) / Math.abs(rangeBaseValue)) * 100
          : null
        const chartKey = `${points.length}:${points[0]?.key ?? points[0]?.date ?? ''}:${points.at(-1)?.key ?? points.at(-1)?.date ?? ''}`

        // Candle bodies and wicks, one path per direction.
        const candlePaths: Record<CandleDirection, { wicks: string; bodies: string }> = {
          up: { wicks: '', bodies: '' },
          down: { wicks: '', bodies: '' },
          unknown: { wicks: '', bodies: '' },
        }
        if (candles) {
          const step = innerWidth / Math.max(1, points.length - 1)
          const bodyWidth = Math.max(1, Math.min(12, step * 0.66))
          renderedPoints.forEach((point) => {
            const paths = candlePaths[candleDirection(point.open, point.value)]
            const x = point.x
            if (typeof point.high === 'number' && typeof point.low === 'number') {
              paths.wicks += `M${x.toFixed(2)} ${yOf(point.high).toFixed(2)}V${yOf(point.low).toFixed(2)}`
            }
            const top = typeof point.open === 'number' ? Math.min(yOf(point.open), point.y) : point.y - 0.5
            const bodyHeight = typeof point.open === 'number' ? Math.max(1, Math.abs(yOf(point.open) - point.y)) : 1
            paths.bodies += `M${(x - bodyWidth / 2).toFixed(2)} ${top.toFixed(2)}h${bodyWidth.toFixed(2)}v${bodyHeight.toFixed(2)}h${(-bodyWidth).toFixed(2)}Z`
          })
        }

        // The sweep starts wholly left of the plot and ends with its soft edge past the last candle.
        const revealFeather = Math.min(120, innerWidth * 0.3)
        const revealLeft = padding.left - 12
        const revealWidth = innerWidth + 24 + revealFeather
        const revealSolid = ((revealWidth - revealFeather) / revealWidth).toFixed(3)

        const measurement = measure ? measureBetween(renderedPoints, measure.first, measure.second) : null
        const measureLeft = measure ? renderedPoints[Math.min(measure.first, measure.second)] : null
        const measureRight = measure ? renderedPoints[Math.max(measure.first, measure.second)] : null
        const activeEnd = measure && measuring ? renderedPoints[measure.second] ?? null : null
        // Put the summary in the plot corner that covers the least: never over
        // the measured span, and away from the line where possible.
        const summarySize = { width: Math.min(200, innerWidth - 16), height: 70 }
        let summaryAt = { left: padding.left + 8, top: padding.top + 4 }
        if (measureLeft && measureRight) {
          const plotLeft = padding.left + 4
          const plotRight = padding.left + innerWidth - 4
          // The plot's corners, plus the spots just outside either side of the span.
          const xs = [
            padding.left + 8,
            padding.left + innerWidth - 8 - summarySize.width,
            measureLeft.x - 12 - summarySize.width,
            measureRight.x + 12,
            padding.left + (innerWidth - summarySize.width) / 2,
          ].filter((left) => left >= plotLeft && left + summarySize.width <= plotRight)
          const ys = [padding.top + 4, padding.top + innerHeight - 4 - summarySize.height]
          let best = Infinity
          for (const top of ys) {
            for (const left of xs) {
              const right = left + summarySize.width
              const bottom = top + summarySize.height
              const overlapsSpan = Math.min(right, measureRight.x + 12) - Math.max(left, measureLeft.x - 12) > 0
              let covered = 0
              for (const point of renderedPoints) {
                if (point.x < left || point.x > right) continue
                const high = candles && typeof point.high === 'number' ? yOf(point.high) : point.y
                const low = candles && typeof point.low === 'number' ? yOf(point.low) : point.y
                if (low >= top && high <= bottom) covered += 1
              }
              // Never cover the day under the finger; avoid the span; then the line.
              const coversActive = activeEnd !== null
                && activeEnd.x >= left - 12 && activeEnd.x <= right + 12
                && activeEnd.y >= top - 12 && activeEnd.y <= bottom + 12
              const score = (coversActive ? 100_000 : 0) + (overlapsSpan ? 10_000 : 0) + covered
              if (score < best) {
                best = score
                summaryAt = { left, top }
              }
            }
          }
        }

        return (
          <div
            ref={canvasRef}
            className={cn(styles.canvas, measurable && styles.measurable)}
            data-chart-state="available"
            data-chart-mode={mode}
            data-measuring={measuring ? 'true' : undefined}
            data-temporal-line-chart=""
          >
            <svg width={width} height={height} className={styles.svg} role="img" aria-label={ariaLabel}>
              {yTicks.map((tick) => {
                const y = yOf(tick)
                return <line key={tick} x1={padding.left} y1={y} x2={padding.left + innerWidth} y2={y} className={styles.gridLine} />
              })}

              {measureLeft && measureRight ? (
                <g data-measure-band="">
                  <rect
                    x={measureLeft.x}
                    y={padding.top}
                    width={Math.max(1, measureRight.x - measureLeft.x)}
                    height={innerHeight}
                    className={cn(styles.measureBand, measurement?.direction === 'down' ? styles.bandDown : styles.bandUp)}
                  />
                  <line x1={measureLeft.x} y1={padding.top} x2={measureLeft.x} y2={padding.top + innerHeight} className={styles.measureEdge} />
                  <line x1={measureRight.x} y1={padding.top} x2={measureRight.x} y2={padding.top + innerHeight} className={styles.measureEdge} />
                  {activeEnd ? (
                    // The day under the finger, drawn full height so it shows above a thumb.
                    <line x1={activeEnd.x} y1={padding.top} x2={activeEnd.x} y2={padding.top + innerHeight} className={styles.measureActive} />
                  ) : null}
                </g>
              ) : null}

              {candles ? (
                // Candles light up left to right behind a soft edge, as the line draws in.
                <g key={`candles-${chartKey}`} mask={`url(#${revealId})`}>
                  <defs>
                    <linearGradient id={`${revealId}-edge`}>
                      <stop offset={revealSolid} stopColor="#fff" />
                      <stop offset="1" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                    <mask id={revealId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
                      <rect
                        className={styles.revealSweep}
                        x={revealLeft}
                        y="0"
                        width={revealWidth}
                        height={height}
                        fill={`url(#${revealId}-edge)`}
                      />
                    </mask>
                  </defs>
                  {(['up', 'down', 'unknown'] as const).map((direction) => (
                    <g key={direction} className={styles[`candle_${direction}`]}>
                      <path d={candlePaths[direction].wicks} className={styles.wick} />
                      <path d={candlePaths[direction].bodies} className={styles.body} />
                    </g>
                  ))}
                </g>
              ) : (
                <>
                  <path key={`area-${chartKey}`} className={styles.area} d={areaPath} />
                  <path key={`line-${chartKey}`} className={styles.line} d={linePath} pathLength={1} />
                </>
              )}

              {measureLeft && measureRight ? (
                <>
                  <circle cx={measureLeft.x} cy={measureLeft.y} r="4" className={styles.measureDot} />
                  <circle cx={measureRight.x} cy={measureRight.y} r="4" className={styles.measureDot} />
                  {activeEnd ? <circle cx={activeEnd.x} cy={activeEnd.y} r="9" className={styles.measureRing} /> : null}
                </>
              ) : null}

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

              {yTicks.map((tick) => (
                <text key={`y-${tick}`} x={width - 4} y={yOf(tick) + 4} textAnchor="end" className={styles.axisValue}>{formatChartValue(tick, valueFormat, currency)}</text>
              ))}

              <rect
                x={padding.left}
                y={padding.top}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onPointerDown={(event) => {
                  const index = indexAt(event, renderedPoints.length, innerWidth)
                  // A tap on the chart clears a finished measurement before anything else.
                  if (measure && !measuring) clearMeasure()
                  readPoint(index, event.pointerType)
                  if (!measurable || (event.pointerType === 'mouse' && event.button !== 0)) return
                  const previous = gestureRef.current
                  if (previous?.timer) window.clearTimeout(previous.timer)
                  const gesture: MeasureGesture = {
                    pointerId: event.pointerId,
                    mouse: event.pointerType === 'mouse',
                    startX: event.clientX,
                    startY: event.clientY,
                    startIndex: index,
                    active: false,
                    timer: null,
                  }
                  if (!gesture.mouse) {
                    const element = event.currentTarget
                    gesture.timer = window.setTimeout(() => {
                      gesture.timer = null
                      if (gestureRef.current === gesture) startMeasuring(gesture, element)
                    }, LONG_PRESS_MS)
                  }
                  gestureRef.current = gesture
                }}
                onPointerMove={(event) => {
                  const index = indexAt(event, renderedPoints.length, innerWidth)
                  const gesture = gestureRef.current
                  if (gesture && gesture.pointerId === event.pointerId) {
                    const moved = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY)
                    if (!gesture.active && moved > LONG_PRESS_SLOP_PX) {
                      // A mouse drag measures; a touch that moves early is a scrub or a scroll.
                      if (gesture.mouse) startMeasuring(gesture, event.currentTarget)
                      else endGesture(false)
                    }
                    if (gesture.active) {
                      setMeasure({ first: gesture.startIndex, second: index })
                      return
                    }
                  }
                  readPoint(index, event.pointerType)
                }}
                onPointerUp={() => endGesture(true)}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse' && !gestureRef.current?.active) setHoverIndex(null)
                }}
                onPointerCancel={() => {
                  // The page took the gesture for a vertical scroll.
                  endGesture(false)
                  setHoverIndex(null)
                  setTouchReading(false)
                }}
              />
            </svg>

            {hoverPoint ? (
              <div
                ref={measureReading}
                className={styles.tooltip}
                data-chart-tooltip=""
                style={{ left: readingAt?.left ?? 0, top: readingAt?.top ?? 0 }}
              >
                <div className={styles.tooltipMeta}>{formatDate(hoverPoint.date)}</div>
                {candles ? (
                  <dl className={styles.tooltipCandle}>
                    {typeof hoverPoint.open === 'number' ? <div><dt>Open</dt><dd>{formatChartValue(hoverPoint.open, valueFormat, currency)}</dd></div> : null}
                    {typeof hoverPoint.high === 'number' ? <div><dt>High</dt><dd>{formatChartValue(hoverPoint.high, valueFormat, currency)}</dd></div> : null}
                    {typeof hoverPoint.low === 'number' ? <div><dt>Low</dt><dd>{formatChartValue(hoverPoint.low, valueFormat, currency)}</dd></div> : null}
                    <div><dt>Close</dt><dd>{formatChartValue(hoverPoint.value, valueFormat, currency)}</dd></div>
                  </dl>
                ) : (
                  <div className={styles.tooltipValue}>{formatChartValue(hoverPoint.value, valueFormat, currency)}</div>
                )}
                {showRangeChange && rangeChange !== null && firstRenderedPoint ? (
                  <div className={cn(styles.tooltipChange, rangeChange > 0 ? styles.positive : rangeChange < 0 ? styles.negative : styles.neutral)}>
                    {formatRangeChange(rangeChange)} <span>since {formatDate(firstRenderedPoint.date)}</span>
                  </div>
                ) : null}
                {hoverPoint.tooltipMeta ? <div className={styles.tooltipMeta}>{hoverPoint.tooltipMeta}</div> : null}
              </div>
            ) : null}

            {measurement ? (
              <MeasureSummary
                measurement={measurement}
                formatChange={formatChange}
                className={styles.measureSummary}
                style={{ left: summaryAt.left, top: summaryAt.top, maxWidth: summarySize.width }}
              />
            ) : null}
            {measurable ? (
              <p className="sr-only" aria-live="polite">
                {measurement && !measuring ? describeMeasurement(measurement, formatChange) : ''}
              </p>
            ) : null}
          </div>
        )
      }}
    </ChartContainer>
  )
}
