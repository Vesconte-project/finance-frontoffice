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

function Plot({
  bars,
  box,
  variant,
  values,
  maxAxis,
}: {
  bars: readonly ReportedBar[]
  box: PlotBox
  variant: 'wide' | 'compact'
  values: 'all' | 'ends'
  maxAxis: number
}) {
  const layout = barLayout(bars.map((bar) => bar.value), box, { maxBar: variant === 'wide' ? 64 : 40 })
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
        return (
          <rect
            key={bar.key}
            className={styles.bar}
            data-highlighted={bar.highlighted ? 'true' : undefined}
            data-negative={geometry.negative ? 'true' : undefined}
            x={geometry.x}
            y={geometry.y}
            width={geometry.width}
            height={Math.max(geometry.height, 0.5)}
          />
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
}: {
  bars: readonly ReportedBar[]
  ariaLabel: string
  values?: { wide: 'all' | 'ends'; compact: 'all' | 'ends' }
  maxAxis?: { wide: number; compact: number }
}) {
  return (
    <ChartFrame ariaLabel={ariaLabel} className={styles.frame}>
      <Plot bars={bars} box={WIDE} variant="wide" values={values.wide} maxAxis={maxAxis.wide} />
      <Plot bars={bars} box={COMPACT} variant="compact" values={values.compact} maxAxis={maxAxis.compact} />
    </ChartFrame>
  )
}
