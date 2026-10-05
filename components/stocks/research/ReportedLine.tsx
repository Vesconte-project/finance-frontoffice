import ChartFrame, { ChartLabel, ChartPlot } from '@/components/stocks/research/ChartFrame'
import type { PlotBox } from '@/lib/chart-labels'
import { highestPoint, lineGeometry, timeTicks, type MultiplePoint } from '@/lib/valuation-reading'
import styles from './ReportedLine.module.css'

const WIDE: PlotBox = { width: 640, height: 260 }
const COMPACT: PlotBox = { width: 320, height: 220 }

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(date: string): string {
  return dayFormat.format(Date.parse(`${date}T00:00:00Z`))
}

function Plot({
  points,
  box,
  variant,
  format,
}: {
  points: readonly MultiplePoint[]
  box: PlotBox
  variant: 'wide' | 'compact'
  format: (value: number) => string
}) {
  const geometry = lineGeometry(points, box, { right: variant === 'wide' ? 8 : 6 })
  const last = points.length - 1
  const peak = highestPoint(points)
  const ticks = timeTicks(points.map((point) => point.date), variant === 'wide' ? 8 : 4)
  const plotLeft = 6
  const plotWidth = box.width - plotLeft - (variant === 'wide' ? 8 : 6)
  // Labels sit above their point; near an edge they align with it instead of
  // centring, so they stay on the plot.
  const anchorFor = (x: number) => (x < box.width * 0.15 ? 'start' : x > box.width * 0.85 ? 'end' : 'middle') as 'start' | 'middle' | 'end'
  const showPeak = peak !== null && peak.index !== last && points.length > 2

  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={(
        <>
          {showPeak ? (
            <ChartLabel box={box} x={geometry.xs[peak.index]} y={geometry.ys[peak.index] - 8} anchor={anchorFor(geometry.xs[peak.index])} baseline="end" strong>
              {format(peak.point.value)} · {variant === 'wide' ? formatDay(peak.point.date) : peak.point.date.slice(5, 10).replace('-', '/')}
            </ChartLabel>
          ) : null}
          <ChartLabel box={box} x={geometry.xs[last]} y={geometry.ys[last] + 10} anchor="end" baseline="start" tone="accent">
            {format(points[last].value)}
          </ChartLabel>
          {ticks.map((tick) => (
            <ChartLabel
              key={`${tick.position}`}
              box={box}
              x={plotLeft + tick.position * plotWidth}
              y={box.height - 14}
              anchor={anchorFor(plotLeft + tick.position * plotWidth)}
              tone="muted"
            >
              {variant === 'wide' ? tick.label : tick.short}
            </ChartLabel>
          ))}
        </>
      )}
    >
      <path className={styles.line} d={geometry.path} />
      {showPeak ? <circle className={styles.peak} cx={geometry.xs[peak.index]} cy={geometry.ys[peak.index]} r={3.5} /> : null}
      <circle className={styles.latest} cx={geometry.xs[last]} cy={geometry.ys[last]} r={4.5} />
    </ChartPlot>
  )
}

/**
 * A reported series over time, with its highest point and its latest value
 * written on the line. Nothing is drawn that the series does not report.
 */
export default function ReportedLine({
  points,
  ariaLabel,
  format,
}: {
  points: readonly MultiplePoint[]
  ariaLabel: string
  format: (value: number) => string
}) {
  return (
    <ChartFrame ariaLabel={ariaLabel} className={styles.frame}>
      <Plot points={points} box={WIDE} variant="wide" format={format} />
      <Plot points={points} box={COMPACT} variant="compact" format={format} />
    </ChartFrame>
  )
}
