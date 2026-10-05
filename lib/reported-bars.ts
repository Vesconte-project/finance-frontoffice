/**
 * Geometry for a bar chart of reported values, drawn from a zero line.
 *
 * The scale always includes zero, so a bar's length is its value; negative
 * values hang below the zero line. Room is kept above and below the plot for
 * the labels written on it.
 */
import type { PlotBox } from './chart-labels'

export type BarGeometry = {
  x: number
  width: number
  /** Top edge of the drawn rectangle. */
  y: number
  height: number
  /** Centre of the bar along the x axis. */
  centre: number
  /** Where the value label sits: just past the bar's outer end. */
  labelY: number
  negative: boolean
}

export type BarLayout = {
  bars: BarGeometry[]
  zeroY: number
  /** Where the axis labels sit, under the plot. */
  axisY: number
}

export function barLayout(
  values: readonly number[],
  box: PlotBox,
  {
    top = 30,
    bottom = 30,
    side = 4,
    fill = 0.62,
    maxBar = 64,
  }: { top?: number; bottom?: number; side?: number; fill?: number; maxBar?: number } = {},
): BarLayout {
  const finite = values.map((value) => (Number.isFinite(value) ? value : 0))
  const high = Math.max(0, ...finite)
  const low = Math.min(0, ...finite)
  const span = high - low || 1
  const plotTop = top
  // A loss writes its value under its bar, so keep that room above the names.
  const plotBottom = box.height - bottom - (low < 0 ? top * 0.75 : 0)
  const plotHeight = Math.max(1, plotBottom - plotTop)
  const scale = (value: number) => plotTop + ((high - value) / span) * plotHeight
  const zeroY = scale(0)
  const slot = (box.width - side * 2) / Math.max(1, finite.length)
  const width = Math.max(1, Math.min(maxBar, slot * fill))

  const bars = finite.map((value, index) => {
    const centre = side + slot * index + slot / 2
    const end = scale(value)
    const negative = value < 0
    return {
      x: centre - width / 2,
      width,
      y: Math.min(zeroY, end),
      height: Math.abs(end - zeroY),
      centre,
      labelY: negative ? end + 4 : end - 4,
      negative,
    }
  })
  return { bars, zeroY, axisY: box.height - bottom / 2 }
}

/**
 * Indexes whose value is written on a chart: every bar when they fit, otherwise
 * the first, the last and any the reader picked.
 */
export function labelledIndexes(count: number, mode: 'all' | 'ends', picked: readonly number[] = []): Set<number> {
  if (count <= 0) return new Set()
  if (mode === 'all') return new Set(Array.from({ length: count }, (_, index) => index))
  return new Set([0, count - 1, ...picked.filter((index) => index >= 0 && index < count)])
}

/** Every `step`-th axis label, always keeping the last, so labels never collide. */
export function sparseAxis(count: number, maxLabels: number): Set<number> {
  if (count <= maxLabels) return new Set(Array.from({ length: count }, (_, index) => index))
  const step = Math.ceil(count / Math.max(1, maxLabels))
  const shown = new Set<number>()
  for (let index = count - 1; index >= 0; index -= step) shown.add(index)
  return shown
}
