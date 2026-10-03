import type { OhlcPoint } from './ohlc-data'

/*
 * Pure geometry and range logic for the expanded ticker chart.
 *
 * Every value drawn comes from the backend OHLC rows unchanged. Nothing here
 * derives an indicator series: moving averages, bands and oscillators stay
 * unavailable until the backend supplies them (ENG-152). Fibonacci levels are
 * arithmetic between two prices the reader picked, not data.
 */

export type ExpandedChartRange = '1M' | '3M' | 'YTD' | '1Y' | '5Y' | '10Y' | 'ALL'

/** Ranges that need intraday bars, which the backend does not supply (ENG-153). */
export const INTRADAY_RANGES = ['1D', '5D'] as const

/** The ticker page loads at most this many days of OHLC (see `loadStockOhlcDataset`). */
export const OHLC_LOAD_WINDOW_DAYS = 3650

const DAY_MS = 24 * 60 * 60 * 1000
const RANGE_DAYS: Record<Exclude<ExpandedChartRange, 'YTD' | 'ALL'>, number> = {
  '1M': 31,
  '3M': 92,
  '1Y': 365,
  '5Y': 1826,
  '10Y': 3652,
}

export type ChartView = { from: number; to: number }

export const MIN_VISIBLE_BARS = 12

function dayValue(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime()
}

/**
 * "All" is only offered when the loaded rows are the whole history. The page
 * loads a ten-year window, so a series that starts at that window's edge is
 * probably cut off, and calling it "All" would overstate it.
 */
export function isFullHistoryLoaded(bars: readonly OhlcPoint[], loadWindowDays = OHLC_LOAD_WINDOW_DAYS): boolean {
  if (bars.length < 2) return true
  const first = dayValue(bars[0].date)
  const last = dayValue(bars[bars.length - 1].date)
  return last - first < (loadWindowDays - 14) * DAY_MS
}

/** Ranges the loaded rows can honestly show, shortest first. */
export function availableRanges(bars: readonly OhlcPoint[]): ExpandedChartRange[] {
  const ranges: ExpandedChartRange[] = ['1M', '3M', 'YTD', '1Y', '5Y', '10Y']
  if (isFullHistoryLoaded(bars)) ranges.push('ALL')
  return ranges
}

/** Index of the first bar inside the range, or 0 when the range covers everything loaded. */
export function rangeStartIndex(bars: readonly OhlcPoint[], range: ExpandedChartRange): number {
  if (bars.length === 0 || range === 'ALL') return 0
  const last = new Date(`${bars[bars.length - 1].date}T00:00:00Z`)
  const start = range === 'YTD'
    ? Date.UTC(last.getUTCFullYear(), 0, 1)
    : last.getTime() - RANGE_DAYS[range] * DAY_MS
  const index = bars.findIndex((bar) => dayValue(bar.date) >= start)
  return index === -1 ? bars.length - 1 : index
}

/** View for a range: the range's bars plus a little room on the right for the last price. */
export function viewForRange(bars: readonly OhlcPoint[], range: ExpandedChartRange): ChartView {
  const n = bars.length
  const start = rangeStartIndex(bars, range)
  const span = Math.max(1, n - start)
  return clampView({ from: start - 0.5, to: n - 0.5 + Math.max(2, span * 0.04) }, n)
}

/** Keeps the view between MIN_VISIBLE_BARS and all bars, with a small margin past either end. */
export function clampView(view: ChartView, barCount: number): ChartView {
  const n = Math.max(1, barCount)
  const span = Math.max(Math.min(MIN_VISIBLE_BARS, n + 2), Math.min(n + 40, view.to - view.from))
  const mid = (view.from + view.to) / 2
  let from = mid - span / 2
  let to = mid + span / 2
  const maxTo = n + Math.max(3, span * 0.12)
  const minFrom = -span * 0.12
  if (to > maxTo) {
    from -= to - maxTo
    to = maxTo
  }
  if (from < minFrom) {
    to += minFrom - from
    from = minFrom
  }
  return { from, to }
}

/** Zooms around an anchor bar index so the bar under the pointer stays put. */
export function zoomView(view: ChartView, factor: number, anchorIndex: number, anchorRatio: number, barCount: number): ChartView {
  const span = (view.to - view.from) * factor
  const from = anchorIndex + 0.5 - anchorRatio * span
  return clampView({ from, to: from + span }, barCount)
}

export function panView(view: ChartView, bars: number, barCount: number): ChartView {
  return clampView({ from: view.from + bars, to: view.to + bars }, barCount)
}

/** 1, 2 or 5 times a power of ten, the usual axis steps. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1
  const power = Math.pow(10, Math.floor(Math.log10(raw)))
  const fraction = raw / power
  return (fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10) * power
}

export function priceTicks(min: number, max: number, approxCount: number): number[] {
  if (!(max > min)) return []
  const step = niceStep((max - min) / Math.max(2, approxCount))
  const ticks: number[] = []
  // Integer stepping avoids accumulated floating-point drift.
  const first = Math.ceil(min / step)
  for (let k = first; k * step <= max; k += 1) ticks.push(Number((k * step).toPrecision(12)))
  return ticks
}

export type PriceExtent = { min: number; max: number }

/**
 * Lowest and highest price shown between two bar indices. Candles use high and
 * low where the backend supplied them and fall back to the close, never to an
 * estimate.
 */
export function visibleExtent(bars: readonly OhlcPoint[], from: number, to: number, kind: 'candles' | 'line'): PriceExtent | null {
  const a = Math.max(0, Math.floor(from))
  const z = Math.min(bars.length - 1, Math.ceil(to))
  let min = Infinity
  let max = -Infinity
  for (let i = a; i <= z; i += 1) {
    const bar = bars[i]
    const low = kind === 'candles' && bar.low !== null ? bar.low : bar.close
    const high = kind === 'candles' && bar.high !== null ? bar.high : bar.close
    if (low < min) min = low
    if (high > max) max = high
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  const pad = (max - min) * 0.06 || Math.abs(max) * 0.05 || 1
  return { min: min - pad, max: max + pad }
}

export type TimeLabel = { index: number; text: string; year: boolean }

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

/**
 * Month or year boundaries inside the view, thinned so labels never sit
 * closer than `minGapPx`. Year boundaries are labelled with the year.
 */
export function timeAxisLabels(
  bars: readonly OhlcPoint[],
  view: ChartView,
  plotWidth: number,
  minGapPx = 56,
): TimeLabel[] {
  const span = view.to - view.from
  const barWidth = plotWidth / span
  const yearly = span > 600
  const quarterly = !yearly && span > 300
  const a = Math.max(1, Math.floor(view.from))
  const z = Math.min(bars.length - 1, Math.ceil(view.to))
  const labels: TimeLabel[] = []
  let lastX = -Infinity
  for (let i = a; i <= z; i += 1) {
    const previous = new Date(`${bars[i - 1].date}T00:00:00Z`)
    const current = new Date(`${bars[i].date}T00:00:00Z`)
    const newYear = current.getUTCFullYear() !== previous.getUTCFullYear()
    const newMonth = current.getUTCMonth() !== previous.getUTCMonth()
    const wanted = newYear || (newMonth && !yearly && (!quarterly || current.getUTCMonth() % 3 === 0))
    if (!wanted) continue
    const x = (i - view.from + 0.5) * barWidth
    if (x < 20 || x > plotWidth - 20 || x - lastX < minGapPx) continue
    labels.push({ index: i, text: newYear ? String(current.getUTCFullYear()) : MONTH_FORMAT.format(current), year: newYear })
    lastX = x
  }
  return labels
}

export const FIBONACCI_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const

/** Retracement levels from the second picked price back towards the first. */
export function fibonacciLevels(firstPrice: number, secondPrice: number): Array<{ ratio: number; price: number }> {
  return FIBONACCI_RATIOS.map((ratio) => ({ ratio, price: secondPrice - (secondPrice - firstPrice) * ratio }))
}

export type VisibleSummary = {
  firstDate: string
  lastDate: string
  firstClose: number
  lastClose: number
  high: number
  low: number
}

/** Facts a screen reader announces for the visible range. */
export function summarizeVisible(bars: readonly OhlcPoint[], view: ChartView): VisibleSummary | null {
  const a = Math.max(0, Math.ceil(view.from))
  const z = Math.min(bars.length - 1, Math.floor(view.to))
  if (z <= a) return null
  let high = -Infinity
  let low = Infinity
  for (let i = a; i <= z; i += 1) {
    high = Math.max(high, bars[i].high ?? bars[i].close)
    low = Math.min(low, bars[i].low ?? bars[i].close)
  }
  return { firstDate: bars[a].date, lastDate: bars[z].date, firstClose: bars[a].close, lastClose: bars[z].close, high, low }
}
