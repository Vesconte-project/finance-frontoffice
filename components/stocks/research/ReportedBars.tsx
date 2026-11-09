import ChartFrame, { ChartLabel, ChartPlot } from '@/components/stocks/research/ChartFrame'
import type { PlotBox } from '@/lib/chart-labels'
import { barLayout, labelledIndexes, sparseAxis } from '@/lib/reported-bars'
import styles from './ReportedBars.module.css'

export type ReportedBar = {
  key: string
  value: number
  /** The value as written on the chart. */
  valueLabel: string
  /** Name under the bar in the wide drawing; omitted bars carry no name. */
  axisLabel?: string | null
  /** Shorter name for the compact drawing ('25 for 2025). */
  axisShort?: string | null
  highlighted?: boolean
}

const WIDE: PlotBox = { width: 600, height: 250 }
const COMPACT: PlotBox = { width: 320, height: 230 }
/** The slim drawing is wider than tall, to fill a chart panel without towering. */
const SLIM_WIDE: PlotBox = { width: 600, height: 205 }

/** A bar with its data end rounded and its baseline end square. */
function barPath(x: number, y: number, width: number, height: number, negative: boolean): string {
  const r = Math.min(3, width / 2, height)
  if (r <= 0) return `M${x},${y}h${width}v${height}h${-width}Z`
  return negative
    ? `M${x},${y}h${width}v${height - r}q0,${r} ${-r},${r}h${-(width - 2 * r)}q${-r},0 ${-r},${-r}Z`
    : `M${x},${y + height}v${-(height - r)}q0,${-r} ${r},${-r}h${width - 2 * r}q${r},0 ${r},${r}v${height - r}Z`
}

function Plot({
  bars,
  box,
  variant,
  values,
  maxAxis,
  slim,
}: {
  bars: readonly ReportedBar[]
  box: PlotBox
  variant: 'wide' | 'compact'
  values: 'all' | 'ends'
  maxAxis: number
  slim: boolean
}) {
  const maxBar = slim ? (variant === 'wide' ? 34 : 22) : variant === 'wide' ? 64 : 40
  const layout = barLayout(bars.map((bar) => bar.value), box, { maxBar, fill: slim ? 0.5 : 0.62 })
  const picked = bars.flatMap((bar, index) => (bar.highlighted ? [index] : []))
  const written = labelledIndexes(bars.length, values, picked)
  const named = bars.map((bar) => (variant === 'wide' ? bar.axisLabel : bar.axisShort ?? bar.axisLabel) ?? null)
  const namedIndexes = named.flatMap((name, index) => (name ? [index] : []))
  const shownNames = new Set([...sparseAxis(namedIndexes.length, maxAxis)].map((position) => namedIndexes[position]))
  // Labels are centred on their bar, except at the two ends of the chart, where
  // they align with the bar's outer edge so they stay on the plot.
  const along = (index: number): { x: number; anchor: 'start' | 'middle' | 'end' } => {
    const bar = layout.bars[index]
    if (bars.length > 1 && index === 0) return { x: bar.x, anchor: 'start' }
    if (bars.length > 1 && index === bars.length - 1) return { x: bar.x + bar.width, anchor: 'end' }
    return { x: bar.centre, anchor: 'middle' }
  }

  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={(
        <>
          {bars.map((bar, index) => written.has(index) ? (
            <ChartLabel
              key={`value-${bar.key}`}
              box={box}
              x={along(index).x}
              anchor={along(index).anchor}
              y={layout.bars[index].labelY}
              baseline={layout.bars[index].negative ? 'start' : 'end'}
              tone={bar.value < 0 ? 'down' : undefined}
              strong={Boolean(bar.highlighted)}
            >
              {bar.valueLabel}
            </ChartLabel>
          ) : null)}
          {bars.map((bar, index) => shownNames.has(index) ? (
            <ChartLabel key={`axis-${bar.key}`} box={box} x={along(index).x} anchor={along(index).anchor} y={layout.axisY} tone="muted">
              {named[index]}
            </ChartLabel>
          ) : null)}
        </>
      )}
    >
      <line className={styles.zero} x1={0} x2={box.width} y1={layout.zeroY} y2={layout.zeroY} />
      {bars.map((bar, index) => {
        const geometry = layout.bars[index]
        const shared = {
          className: styles.bar,
          'data-highlighted': bar.highlighted ? 'true' : undefined,
          'data-negative': geometry.negative ? 'true' : undefined,
        }
        return slim ? (
          <path key={bar.key} {...shared} d={barPath(geometry.x, geometry.y, geometry.width, Math.max(geometry.height, 0.5), geometry.negative)} />
        ) : (
          <rect key={bar.key} {...shared} x={geometry.x} y={geometry.y} width={geometry.width} height={Math.max(geometry.height, 0.5)} />
        )
      })}
    </ChartPlot>
  )
}

/**
 * Reported values as bars from a zero line, with the numbers written on them.
 * The wide drawing names every bar it can; the compact one, for narrow spaces,
 * writes fewer numbers and shorter names.
 */
export default function ReportedBars({
  bars,
  ariaLabel,
  values = { wide: 'all', compact: 'ends' },
  maxAxis = { wide: 10, compact: 5 },
  slim = false,
}: {
  bars: readonly ReportedBar[]
  ariaLabel: string
  values?: { wide: 'all' | 'ends'; compact: 'all' | 'ends' }
  maxAxis?: { wide: number; compact: number }
  /** Narrower bars with a rounded data end. */
  slim?: boolean
}) {
  return (
    <ChartFrame ariaLabel={ariaLabel} className={styles.frame}>
      <Plot bars={bars} box={slim ? SLIM_WIDE : WIDE} variant="wide" values={values.wide} maxAxis={maxAxis.wide} slim={slim} />
      <Plot bars={bars} box={COMPACT} variant="compact" values={values.compact} maxAxis={maxAxis.compact} slim={slim} />
    </ChartFrame>
  )
}
