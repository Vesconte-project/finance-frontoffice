import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  MIN_VISIBLE_BARS,
  availableRanges,
  clampView,
  fibonacciLevels,
  isFullHistoryLoaded,
  niceStep,
  panView,
  priceTicks,
  rangeStartIndex,
  summarizeVisible,
  timeAxisLabels,
  viewForRange,
  visibleExtent,
  zoomView,
} from '../lib/expanded-chart'
import type { OhlcPoint } from '../lib/ohlc-data'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

/** Weekday bars ending on 2026-09-30, `days` calendar days long. Values are synthetic. */
function weekdayBars(days: number): OhlcPoint[] {
  const last = Date.UTC(2026, 8, 30)
  const bars: OhlcPoint[] = []
  for (let offset = days; offset >= 0; offset -= 1) {
    const time = last - offset * 86_400_000
    const weekday = new Date(time).getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    const close = 100 + (bars.length % 10)
    bars.push({ date: new Date(time).toISOString().slice(0, 10), open: close - 1, high: close + 2, low: close - 3, close, volume: 1000 })
  }
  return bars
}

test('All is offered only when the loaded rows cover the whole history', () => {
  const capped = weekdayBars(3650)
  assert.equal(isFullHistoryLoaded(capped), false)
  assert.deepEqual(availableRanges(capped), ['1M', '3M', 'YTD', '1Y', '5Y', '10Y'])

  const young = weekdayBars(900)
  assert.equal(isFullHistoryLoaded(young), true)
  assert.equal(availableRanges(young).at(-1), 'ALL')
})

test('range start finds the first bar inside the window', () => {
  const bars = weekdayBars(800)
  const ytd = rangeStartIndex(bars, 'YTD')
  assert.equal(bars[ytd].date.slice(0, 4), '2026')
  assert.equal(bars[ytd - 1].date.slice(0, 4), '2025')
  assert.equal(rangeStartIndex(bars, 'ALL'), 0)
  // A range longer than the data starts at the first bar.
  assert.equal(rangeStartIndex(bars, '10Y'), 0)
  const oneMonth = rangeStartIndex(bars, '1M')
  assert.ok(bars.length - oneMonth >= 20 && bars.length - oneMonth <= 24)
})

test('a range view shows its bars and leaves room for the last price', () => {
  const bars = weekdayBars(800)
  const view = viewForRange(bars, '1Y')
  assert.ok(view.from <= rangeStartIndex(bars, '1Y'))
  assert.ok(view.to > bars.length - 0.5)
})

test('clampView keeps a minimum span and stays near the data', () => {
  const tiny = clampView({ from: 100, to: 101 }, 500)
  assert.ok(tiny.to - tiny.from >= MIN_VISIBLE_BARS)
  const wide = clampView({ from: -5000, to: 5000 }, 500)
  assert.ok(wide.to - wide.from <= 540)
  const pastEnd = panView({ from: 400, to: 500 }, 10_000, 500)
  assert.ok(pastEnd.to <= 500 + Math.max(3, (pastEnd.to - pastEnd.from) * 0.12) + 1e-9)
  const beforeStart = panView({ from: 0, to: 100 }, -10_000, 500)
  assert.ok(beforeStart.from >= -(beforeStart.to - beforeStart.from) * 0.12 - 1e-9)
})

test('zoom keeps the anchored bar under the pointer', () => {
  const view = { from: 100, to: 200 }
  const anchor = 150
  const ratio = (anchor + 0.5 - view.from) / (view.to - view.from)
  const zoomed = zoomView(view, 0.5, anchor, ratio, 1000)
  assert.equal(zoomed.to - zoomed.from, 50)
  assert.ok(Math.abs((anchor + 0.5 - zoomed.from) / 50 - ratio) < 1e-9)
})

test('axis steps are 1, 2 or 5 times a power of ten', () => {
  assert.equal(niceStep(0.13), 0.1)
  assert.equal(niceStep(2.4), 2)
  assert.equal(niceStep(37), 50)
  assert.equal(niceStep(0), 1)
  assert.deepEqual(priceTicks(98.2, 112.7, 5), [100, 102, 104, 106, 108, 110, 112])
  assert.deepEqual(priceTicks(98.2, 112.7, 3), [100, 105, 110])
  assert.deepEqual(priceTicks(5, 5, 4), [])
})

test('visible extent uses backend high and low, and falls back to the close', () => {
  const bars: OhlcPoint[] = [
    { date: '2026-09-28', open: 10, high: 12, low: 9, close: 11, volume: null },
    { date: '2026-09-29', open: null, high: null, low: null, close: 20, volume: null },
  ]
  const candles = visibleExtent(bars, 0, 1, 'candles')!
  assert.ok(candles.min < 9 && candles.min > 8)
  assert.ok(candles.max > 20 && candles.max < 21)
  const line = visibleExtent(bars, 0, 1, 'line')!
  assert.ok(line.min < 11 && line.min > 10)
  assert.equal(visibleExtent([], 0, 1, 'line'), null)
})

test('time labels mark month starts without crowding', () => {
  const bars = weekdayBars(400)
  const view = viewForRange(bars, 'ALL')
  const labels = timeAxisLabels(bars, view, 800)
  assert.ok(labels.length >= 4)
  assert.ok(labels.some((label) => label.year && label.text === '2026'))
  const barWidth = 800 / (view.to - view.from)
  for (let i = 1; i < labels.length; i += 1) {
    assert.ok((labels[i].index - labels[i - 1].index) * barWidth >= 56)
  }
})

test('Fibonacci levels run from the second picked price back to the first', () => {
  const levels = fibonacciLevels(100, 200)
  assert.deepEqual(levels.map((level) => level.ratio), [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1])
  assert.equal(levels[0].price, 200)
  assert.equal(levels[3].price, 150)
  assert.equal(levels[6].price, 100)
})

test('the visible summary reports real first and last closes', () => {
  const bars = weekdayBars(60)
  const summary = summarizeVisible(bars, { from: 0, to: bars.length - 1 })!
  assert.equal(summary.firstClose, bars[0].close)
  assert.equal(summary.lastClose, bars[bars.length - 1].close)
  assert.equal(summary.high, Math.max(...bars.map((bar) => bar.high!)))
})

test('the expanded chart draws no indicator series and uses no chart library', () => {
  const sources = [
    'lib/expanded-chart.ts',
    'components/stocks/ExpandedPriceCanvas.tsx',
    'components/stocks/ExpandedChartDialog.tsx',
  ].map(readRepoFile).join('\n')
  // Indicators answer with an error until ENG-152; nothing computes them here.
  assert.doesNotMatch(sources, /technicalSignals|function\s+(sma|ema|rsi|bollinger)/i)
  assert.match(sources, /ENG-152/)
  assert.match(sources, /ENG-153/)
  assert.doesNotMatch(sources, /lightweight-charts|recharts|from 'd3/)
  const pkg = JSON.parse(readRepoFile('package.json')) as { dependencies: Record<string, string> }
  assert.equal(pkg.dependencies['lightweight-charts'], undefined)
})
