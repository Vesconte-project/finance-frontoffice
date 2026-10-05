import ChartFrame, { ChartLabel, ChartPlot } from '@/components/stocks/research/ChartFrame'
import type { PlotBox } from '@/lib/chart-labels'
import styles from './PairedBars.module.css'

export type PairedBar = {
  key: string
  /** First bar of the pair (e.g. what was spent). */
  first: number
  /** Second bar of the pair (e.g. what it is worth now); null draws nothing. */
  second: number | null
  /** Written above the pair. */
  label: string | null
  axisLabel: string
  axisShort: string
}

const WIDE: PlotBox = { width: 640, height: 260 }
const COMPACT: PlotBox = { width: 320, height: 240 }

function Plot({
  pairs,
  box,
  variant,
  bracket,
}: {
  pairs: readonly PairedBar[]
  box: PlotBox
  variant: 'wide' | 'compact'
  bracket: { from: number; label: string } | null
}) {
  const top = bracket ? 52 : 30
  const bottom = 28
  const side = 4
  const high = Math.max(1e-9, ...pairs.flatMap((pair) => [pair.first, pair.second ?? 0]))
  const plotHeight = box.height - top - bottom
  const zeroY = box.height - bottom
  const slot = (box.width - side * 2) / Math.max(1, pairs.length)
  const barWidth = Math.min(variant === 'wide' ? 24 : 12, slot * 0.34)
  const y = (value: number) => zeroY - (value / high) * plotHeight
  const centre = (index: number) => side + slot * index + slot / 2
  const written = new Set(
    variant === 'wide' || pairs.length <= 5
      ? pairs.map((_, index) => index)
      : [0, pairs.length - 1],
  )
  const axisStep = variant === 'wide' ? 1 : Math.ceil(pairs.length / 5)
  const anchorFor = (index: number) => (index === 0 && pairs.length > 1 ? 'start' : index === pairs.length - 1 && pairs.length > 1 ? 'end' : 'middle') as 'start' | 'middle' | 'end'
  const xFor = (index: number) => {
    const anchor = anchorFor(index)
    return anchor === 'start' ? centre(index) - barWidth - 1 : anchor === 'end' ? centre(index) + barWidth + 1 : centre(index)
  }
  const bracketLeft = bracket ? centre(bracket.from) - barWidth - 2 : 0
  const bracketRight = centre(pairs.length - 1) + barWidth + 2

  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={(
        <>
          {pairs.map((pair, index) => (pair.label && written.has(index) ? (
            <ChartLabel key={`m-${pair.key}`} box={box} x={xFor(index)} anchor={anchorFor(index)} y={y(Math.max(pair.first, pair.second ?? 0)) - 4} baseline="end" tone="up">
              {pair.label}
            </ChartLabel>
          ) : null))}
          {pairs.map((pair, index) => ((pairs.length - 1 - index) % axisStep === 0 ? (
            <ChartLabel key={`a-${pair.key}`} box={box} x={xFor(index)} anchor={anchorFor(index)} y={box.height - 12} tone="muted">
              {variant === 'wide' ? pair.axisLabel : pair.axisShort}
            </ChartLabel>
          ) : null))}
          {bracket ? (
            <ChartLabel box={box} x={bracketRight} anchor="end" y={8} baseline="start" tone="muted">{bracket.label}</ChartLabel>
          ) : null}
        </>
      )}
    >
      <line className={styles.zero} x1={0} x2={box.width} y1={zeroY} y2={zeroY} />
      {pairs.map((pair, index) => (
        <g key={pair.key}>
          <rect className={styles.first} x={centre(index) - barWidth - 1} y={y(pair.first)} width={barWidth} height={Math.max(0.5, zeroY - y(pair.first))} />
          {pair.second !== null ? (
            <rect className={styles.second} x={centre(index) + 1} y={y(pair.second)} width={barWidth} height={Math.max(0.5, zeroY - y(pair.second))} />
          ) : null}
        </g>
      ))}
      {bracket ? (
        <path className={styles.bracket} d={`M${bracketLeft},32 L${bracketLeft},26 L${bracketRight},26 L${bracketRight},32`} />
      ) : null}
    </ChartPlot>
  )
}

/** Two bars per period from a zero line (what was spent beside what it is worth now). */
export default function PairedBars({
  pairs,
  ariaLabel,
  bracket = null,
}: {
  pairs: readonly PairedBar[]
  ariaLabel: string
  /** Marks the pairs from `from` to the end, with a label above them. */
  bracket?: { from: number; label: string } | null
}) {
  return (
    <ChartFrame ariaLabel={ariaLabel} className={styles.frame}>
      <Plot pairs={pairs} box={WIDE} variant="wide" bracket={bracket} />
      <Plot pairs={pairs} box={COMPACT} variant="compact" bracket={bracket} />
    </ChartFrame>
  )
}
