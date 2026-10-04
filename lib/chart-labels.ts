/**
 * Placement for chart labels drawn as HTML over an SVG plot.
 *
 * Research charts write names and numbers on the data. The SVG is drawn in its
 * own coordinate space (its viewBox) and stretches with the frame, so labels are
 * page text positioned by percentage: they keep their size while the drawing
 * scales. These helpers convert plot coordinates to those percentages and keep a
 * column of labels from overlapping without leaving the plot.
 */

export type PlotBox = { width: number; height: number }

export type LabelAnchor = 'start' | 'middle' | 'end'

/** Position of a plot coordinate as a CSS percentage of the frame, clamped to 0–100. */
export function plotPercent(value: number, extent: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(extent) || extent <= 0) return '0%'
  const percent = Math.min(100, Math.max(0, (value / extent) * 100))
  return `${Number(percent.toFixed(3))}%`
}

/** Inline style that pins a label to plot coordinates `x`, `y` with the given anchors. */
export function labelPosition(
  box: PlotBox,
  x: number,
  y: number,
  anchor: LabelAnchor = 'middle',
  baseline: LabelAnchor = 'middle',
): { left: string; top: string; transform: string } {
  const shift = (a: LabelAnchor) => (a === 'start' ? '0%' : a === 'end' ? '-100%' : '-50%')
  return {
    left: plotPercent(x, box.width),
    top: plotPercent(y, box.height),
    transform: `translate(${shift(anchor)}, ${shift(baseline)})`,
  }
}

export type StackItem = {
  /** Stable identity, returned unchanged. */
  key: string
  /** Wanted centre along the axis, in the same units as `min`/`max`. */
  at: number
  /** Extent of the label along the axis. */
  size: number
}

/**
 * Moves labels along one axis so that none overlap, keeping their order and
 * staying within `[min, max]`. Each label ends as close to its wanted centre as
 * the others allow. When the labels cannot all fit, they are spread evenly over
 * the available space and the overlap is shared rather than pushed off the plot.
 */
export function stackLabels(
  items: readonly StackItem[],
  { min, max, gap = 0 }: { min: number; max: number; gap?: number },
): Array<StackItem & { placed: number }> {
  if (!items.length) return []
  const ordered = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
  const total = ordered.reduce((sum, item) => sum + item.size, 0) + gap * (ordered.length - 1)
  const span = max - min

  let centres: number[]
  if (total >= span) {
    const step = ordered.length > 1 ? (span - ordered[0].size / 2 - ordered.at(-1)!.size / 2) / (ordered.length - 1) : 0
    centres = ordered.map((item, index) =>
      ordered.length > 1 ? min + ordered[0].size / 2 + step * index : min + span / 2,
    )
  } else {
    centres = ordered.map((item) => Math.min(max - item.size / 2, Math.max(min + item.size / 2, item.at)))
    // Push down past any overlap with the label above…
    for (let i = 1; i < centres.length; i += 1) {
      const floor = centres[i - 1] + ordered[i - 1].size / 2 + gap + ordered[i].size / 2
      if (centres[i] < floor) centres[i] = floor
    }
    // …then back up from the bottom edge, so the last label stays on the plot.
    const last = centres.length - 1
    centres[last] = Math.min(centres[last], max - ordered[last].size / 2)
    for (let i = last - 1; i >= 0; i -= 1) {
      const ceiling = centres[i + 1] - ordered[i + 1].size / 2 - gap - ordered[i].size / 2
      if (centres[i] > ceiling) centres[i] = ceiling
    }
  }

  const placed = new Map(ordered.map((item, index) => [item.index, centres[index]]))
  return items.map((item, index) => ({ ...item, placed: placed.get(index)! }))
}

/**
 * Converts a label's size in CSS pixels into plot units for the smallest width
 * at which the plot is shown. The drawing scales with its frame but the label
 * does not, so stacking must assume the plot at its narrowest: a wide plot from
 * 520px, a compact plot from the narrowest supported screen.
 */
export function plotUnits(pixels: number, box: PlotBox, minRenderedWidth: number): number {
  if (!(minRenderedWidth > 0) || !(box.width > 0)) return pixels
  return pixels * (box.width / minRenderedWidth)
}

/** Narrowest frame width at which each drawing is shown (see ChartFrame). */
export const PLOT_MIN_WIDTH = { wide: 520, compact: 248 } as const
