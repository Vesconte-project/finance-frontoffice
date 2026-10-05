import type { OhlcPoint } from '@/lib/finance'

export type TechnicalTimeframe = '1D' | '1W' | '1M'
export type TechnicalAction = 'Buy' | 'Sell' | 'Neutral'

type Bar = {
  date: string
  high: number
  low: number
  close: number
  volume: number | null
}

export type TechnicalIndicatorRow = {
  name: string
  value: string
  action: TechnicalAction
}

export type TechnicalGaugeData = {
  label: string
  verdict: string
  verdictAction: TechnicalAction
  position: number
  counts: {
    buy: number
    neutral: number
    sell: number
  }
}

export type TechnicalSummary = {
  gauges: {
    summary: TechnicalGaugeData
    oscillators: TechnicalGaugeData
    movingAverages: TechnicalGaugeData
  }
  oscillatorRows: TechnicalIndicatorRow[]
  movingAverageRows: TechnicalIndicatorRow[]
  /** The few readings shown on their own, as numbers (null without enough bars). */
  readings: TechnicalReadings
}

export type TechnicalReadings = {
  close: number | null
  rsi14: number | null
  /** Periods of the two averages for this timeframe (Spec PRD-78: 50/200 days, 20/40 weeks, 10/20 months). */
  averagePeriods: readonly [number, number]
  shortAverage: number | null
  longAverage: number | null
  macd: number | null
  macdSignal: number | null
}

export { distanceFromAverage } from './technical-readings'

/** The two averages the Key readings card measures the price against, per timeframe. */
export const KEY_READING_AVERAGES: Record<TechnicalTimeframe, readonly [number, number]> = {
  '1D': [50, 200],
  '1W': [20, 40],
  '1M': [10, 20],
}

function toBar(p: OhlcPoint): Bar {
  // Quando high/low faltam (histórico pré-2020), usa close como proxy.
  const high = p.high ?? p.close
  const low = p.low ?? p.close
  return { date: p.date, high, low, close: p.close, volume: p.volume }
}

function periodKey(dateIso: string, grain: 'week' | 'month'): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  if (grain === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  // ISO week
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function buildBars(data: OhlcPoint[], timeframe: TechnicalTimeframe): Bar[] {
  const sorted = data.slice().sort((a, b) => a.date.localeCompare(b.date))
  if (timeframe === '1D') return sorted.map(toBar)

  const grain = timeframe === '1W' ? 'week' : 'month'
  const groups = new Map<string, OhlcPoint[]>()
  const order: string[] = []
  for (const p of sorted) {
    const key = periodKey(p.date, grain)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(p)
  }

  return order.map((key) => {
    const pts = groups.get(key)!
    const highs = pts.map((p) => p.high ?? p.close)
    const lows = pts.map((p) => p.low ?? p.close)
    const vols = pts.map((p) => p.volume).filter((v): v is number => v !== null)
    return {
      date: pts[pts.length - 1].date,
      high: Math.max(...highs),
      low: Math.min(...lows),
      close: pts[pts.length - 1].close,
      volume: vols.length > 0 ? vols.reduce((s, v) => s + v, 0) : null,
    }
  })
}

function takeLast(values: number[], count: number): number[] {
  if (values.length <= count) return values
  return values.slice(-count)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatNumber(value: number | null, digits: number = 2): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function actionFromScore(score: number): TechnicalAction {
  if (score >= 0.22) return 'Buy'
  if (score <= -0.22) return 'Sell'
  return 'Neutral'
}

function gaugeLabelFromAction(action: TechnicalAction, score: number): string {
  if (action === 'Buy') return score >= 0.58 ? 'Strong buy' : 'Buy'
  if (action === 'Sell') return score <= -0.58 ? 'Strong sell' : 'Sell'
  return 'Neutral'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function latest(values: number[]): number | null {
  const value = values[values.length - 1]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null
  const slice = values.slice(-period)
  return average(slice)
}

function emaSeries(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return []
  const seed = average(values.slice(0, period))
  if (seed === null) return []

  const multiplier = 2 / (period + 1)
  const output: number[] = [seed]

  for (let index = period; index < values.length; index += 1) {
    const previous = output[output.length - 1] ?? seed
    output.push((values[index] - previous) * multiplier + previous)
  }

  return output
}

function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period)
  return latest(series)
}

function wma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null
  const slice = values.slice(-period)
  const denominator = (period * (period + 1)) / 2
  const numerator = slice.reduce((sum, value, index) => sum + value * (index + 1), 0)
  return numerator / denominator
}

function hma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null
  const half = Math.max(1, Math.floor(period / 2))
  const sqrt = Math.max(1, Math.round(Math.sqrt(period)))
  const transformed: number[] = []

  for (let index = period - 1; index < values.length; index += 1) {
    const prefix = values.slice(0, index + 1)
    const halfWma = wma(prefix, half)
    const fullWma = wma(prefix, period)
    if (halfWma === null || fullWma === null) continue
    transformed.push(2 * halfWma - fullWma)
  }

  return wma(transformed, sqrt)
}

function meanDeviation(values: number[]): number | null {
  const mean = average(values)
  if (mean === null) return null
  return average(values.map((value) => Math.abs(value - mean)))
}

function rsiSeries(values: number[], period: number): number[] {
  if (period <= 0 || values.length <= period) return []

  let gains = 0
  let losses = 0
  for (let index = 1; index <= period; index += 1) {
    const delta = values[index] - values[index - 1]
    gains += Math.max(delta, 0)
    losses += Math.max(-delta, 0)
  }

  let avgGain = gains / period
  let avgLoss = losses / period
  const output: number[] = []

  const seedRs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss
  output.push(100 - 100 / (1 + seedRs))

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1]
    const gain = Math.max(delta, 0)
    const loss = Math.max(-delta, 0)
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss
    output.push(100 - 100 / (1 + rs))
  }

  return output
}

function rsi(values: number[], period: number): number | null {
  return latest(rsiSeries(values, period))
}

function stochasticK(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (period <= 0 || closes.length < period) return null
  const hi = Math.max(...highs.slice(-period))
  const lo = Math.min(...lows.slice(-period))
  const current = closes[closes.length - 1]
  if (!Number.isFinite(current) || hi === lo) return 50
  return ((current - lo) / (hi - lo)) * 100
}

function williamsR(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (period <= 0 || closes.length < period) return null
  const hi = Math.max(...highs.slice(-period))
  const lo = Math.min(...lows.slice(-period))
  const current = closes[closes.length - 1]
  if (!Number.isFinite(current) || hi === lo) return -50
  return ((hi - current) / (hi - lo)) * -100
}

function cci(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (period <= 0 || closes.length < period) return null
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3)
  const slice = tp.slice(-period)
  const mean = average(slice)
  const deviation = meanDeviation(slice)
  const current = slice[slice.length - 1]
  if (mean === null || deviation === null || deviation === 0 || !Number.isFinite(current)) return null
  return (current - mean) / (0.015 * deviation)
}

function adx(highs: number[], lows: number[], closes: number[], period: number): number | null {
  const n = closes.length
  if (period <= 0 || n <= period + 1) return null
  const tr: number[] = []
  const plusDm: number[] = []
  const minusDm: number[] = []
  for (let i = 1; i < n; i += 1) {
    const upMove = highs[i] - highs[i - 1]
    const downMove = lows[i - 1] - lows[i]
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0)
    const hl = highs[i] - lows[i]
    const hc = Math.abs(highs[i] - closes[i - 1])
    const lc = Math.abs(lows[i] - closes[i - 1])
    tr.push(Math.max(hl, hc, lc))
  }
  if (tr.length < period) return null
  const dx: number[] = []
  for (let i = period - 1; i < tr.length; i += 1) {
    const trSum = tr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0)
    if (trSum === 0) { dx.push(0); continue }
    const plus = (plusDm.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / trSum) * 100
    const minus = (minusDm.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / trSum) * 100
    const denom = plus + minus
    dx.push(denom === 0 ? 0 : (Math.abs(plus - minus) / denom) * 100)
  }
  return sma(dx, period)
}

function awesomeOscillator(values: number[]): number | null {
  const fast = sma(values, 5)
  const slow = sma(values, 34)
  if (fast === null || slow === null) return null
  return fast - slow
}

function momentum(values: number[], period: number): number | null {
  if (period <= 0 || values.length <= period) return null
  return values[values.length - 1] - values[values.length - 1 - period]
}

function macd(values: number[]): { macd: number | null; signal: number | null } {
  const ema12Series = emaSeries(values, 12)
  const ema26Series = emaSeries(values, 26)
  if (ema12Series.length === 0 || ema26Series.length === 0) {
    return { macd: null, signal: null }
  }

  const offset = ema12Series.length - ema26Series.length
  const macdSeries = ema26Series.map((value, index) => ema12Series[index + offset] - value)
  const signalSeries = emaSeries(macdSeries, 9)
  return {
    macd: latest(macdSeries),
    signal: latest(signalSeries),
  }
}

function stochasticRsi(values: number[], period: number): number | null {
  const rsiValues = rsiSeries(values, period)
  if (rsiValues.length < period) return null
  const slice = rsiValues.slice(-period)
  const low = Math.min(...slice)
  const high = Math.max(...slice)
  const current = slice[slice.length - 1]
  if (high === low) return 50
  return ((current - low) / (high - low)) * 100
}

function bullBearPower(values: number[]): number | null {
  const ema13 = ema(values, 13)
  const current = latest(values)
  if (ema13 === null || current === null) return null
  return current - ema13
}

function ichimokuBase(values: number[]): number | null {
  if (values.length < 26) return null
  const slice = values.slice(-26)
  return (Math.max(...slice) + Math.min(...slice)) / 2
}

function vwma(closes: number[], volumes: Array<number | null>, period: number): number | null {
  if (period <= 0 || closes.length < period) return null
  const c = closes.slice(-period)
  const v = volumes.slice(-period)
  let num = 0
  let den = 0
  for (let i = 0; i < c.length; i += 1) {
    const vol = v[i]
    if (vol === null || !Number.isFinite(vol)) return null // sem volume → não calculável
    num += c[i] * vol
    den += vol
  }
  return den > 0 ? num / den : null
}

function actionFromRsi(value: number | null): TechnicalAction {
  if (value === null) return 'Neutral'
  if (value <= 30) return 'Buy'
  if (value >= 70) return 'Sell'
  return 'Neutral'
}

function actionFromStochastic(value: number | null): TechnicalAction {
  if (value === null) return 'Neutral'
  if (value <= 20) return 'Buy'
  if (value >= 80) return 'Sell'
  return 'Neutral'
}

function actionFromCci(value: number | null): TechnicalAction {
  if (value === null) return 'Neutral'
  if (value <= -100) return 'Buy'
  if (value >= 100) return 'Sell'
  return 'Neutral'
}

function actionFromAdx(value: number | null, momentumValue: number | null): TechnicalAction {
  if (value === null || momentumValue === null || value < 20) return 'Neutral'
  if (momentumValue > 0) return 'Buy'
  if (momentumValue < 0) return 'Sell'
  return 'Neutral'
}

function actionFromZeroLine(value: number | null): TechnicalAction {
  if (value === null) return 'Neutral'
  if (value > 0) return 'Buy'
  if (value < 0) return 'Sell'
  return 'Neutral'
}

function actionFromWilliams(value: number | null): TechnicalAction {
  if (value === null) return 'Neutral'
  if (value <= -80) return 'Buy'
  if (value >= -20) return 'Sell'
  return 'Neutral'
}

function actionFromPriceLevel(current: number | null, level: number | null): TechnicalAction {
  if (current === null || level === null) return 'Neutral'
  const delta = (current - level) / Math.max(level, 1e-6)
  if (delta > 0.0025) return 'Buy'
  if (delta < -0.0025) return 'Sell'
  return 'Neutral'
}

function formatPriceLevel(level: number | null): string {
  if (level === null || !Number.isFinite(level)) return '—'
  return level.toFixed(2)
}

function formatSignedLevel(level: number | null): string {
  if (level === null || !Number.isFinite(level)) return '—'
  return `${level > 0 ? '+' : ''}${level.toFixed(2)}`
}

function buildGauge(label: string, rows: TechnicalIndicatorRow[]): TechnicalGaugeData {
  const counts = rows.reduce(
    (acc, row) => {
      if (row.action === 'Buy') acc.buy += 1
      else if (row.action === 'Sell') acc.sell += 1
      else acc.neutral += 1
      return acc
    },
    { buy: 0, neutral: 0, sell: 0 }
  )

  const total = Math.max(1, counts.buy + counts.neutral + counts.sell)
  const score = (counts.buy - counts.sell) / total
  const verdictAction = actionFromScore(score)
  return {
    label,
    verdict: gaugeLabelFromAction(verdictAction, score),
    verdictAction,
    position: clamp(((score + 1) / 2) * 100, 0, 100),
    counts,
  }
}

export function buildTechnicalSummary(data: OhlcPoint[], timeframe: TechnicalTimeframe): TechnicalSummary {
  const bars = buildBars(data, timeframe)
  const closes = bars.map((b) => b.close)
  const highs = bars.map((b) => b.high)
  const lows = bars.map((b) => b.low)
  const volumes = bars.map((b) => b.volume)
  const currentPrice = latest(closes)

  const rsi14 = rsi(closes, 14)
  const stochastic14 = stochasticK(highs, lows, closes, 14)
  const cci20 = cci(highs, lows, closes, 20)
  const adx14 = adx(highs, lows, closes, 14)
  const awesome = awesomeOscillator(closes)
  const momentum10 = momentum(closes, 10)
  const macdValue = macd(closes)
  const stochRsi = stochasticRsi(closes, 14)
  const williams14 = williamsR(highs, lows, closes, 14)
  const bullBear = bullBearPower(closes)

  const oscillatorRows: TechnicalIndicatorRow[] = [
    {
      name: 'Relative Strength Index (14)',
      value: formatNumber(rsi14),
      action: actionFromRsi(rsi14),
    },
    {
      name: 'Stochastic %K (14, 3, 3)',
      value: formatNumber(stochastic14),
      action: actionFromStochastic(stochastic14),
    },
    {
      name: 'Commodity Channel Index (20)',
      value: formatSignedLevel(cci20),
      action: actionFromCci(cci20),
    },
    {
      name: 'Average Directional Index (14)',
      value: formatNumber(adx14),
      action: actionFromAdx(adx14, momentum10),
    },
    {
      name: 'Awesome Oscillator',
      value: formatSignedLevel(awesome),
      action: actionFromZeroLine(awesome),
    },
    {
      name: 'Momentum (10)',
      value: formatSignedLevel(momentum10),
      action: actionFromZeroLine(momentum10),
    },
    {
      name: 'MACD Level (12, 26)',
      value: formatSignedLevel(macdValue.macd),
      action:
        macdValue.macd === null || macdValue.signal === null
          ? 'Neutral'
          : macdValue.macd > macdValue.signal
            ? 'Buy'
            : macdValue.macd < macdValue.signal
              ? 'Sell'
              : 'Neutral',
    },
    {
      name: 'Stochastic RSI Fast (3, 3, 14, 14)',
      value: formatNumber(stochRsi),
      action: actionFromStochastic(stochRsi),
    },
    {
      name: 'Williams Percent Range (14)',
      value: formatNumber(williams14),
      action: actionFromWilliams(williams14),
    },
    {
      name: 'Bull Bear Power',
      value: formatSignedLevel(bullBear),
      action: actionFromZeroLine(bullBear),
    },
  ]

  const movingAverageValues: Array<[string, number | null]> = [
    ['EMA (10)', ema(closes, 10)],
    ['SMA (10)', sma(closes, 10)],
    ['EMA (20)', ema(closes, 20)],
    ['SMA (20)', sma(closes, 20)],
    ['EMA (30)', ema(closes, 30)],
    ['SMA (30)', sma(closes, 30)],
    ['EMA (50)', ema(closes, 50)],
    ['SMA (50)', sma(closes, 50)],
    ['EMA (100)', ema(closes, 100)],
    ['SMA (100)', sma(closes, 100)],
    ['EMA (150)', ema(closes, 150)],
    ['SMA (150)', sma(closes, 150)],
    ['EMA (200)', ema(closes, 200)],
    ['SMA (200)', sma(closes, 200)],
    ['Ichimoku Base Line (9, 26, 52, 26)', ichimokuBase(closes)],
    ['Volume Weighted MA (20)', vwma(closes, volumes, 20)],
    ['Hull Moving Average (9)', hma(closes, 9)],
  ]

  const movingAverageRows: TechnicalIndicatorRow[] = movingAverageValues.map(([name, value]) => ({
    name,
    value: formatPriceLevel(value),
    action: actionFromPriceLevel(currentPrice, value),
  }))

  const oscillatorGauge = buildGauge('Oscillators', oscillatorRows)
  const movingAverageGauge = buildGauge('Moving Averages', movingAverageRows)
  const summaryGauge = buildGauge('Summary', [...oscillatorRows, ...movingAverageRows])

  return {
    gauges: {
      summary: summaryGauge,
      oscillators: oscillatorGauge,
      movingAverages: movingAverageGauge,
    },
    oscillatorRows,
    movingAverageRows,
    readings: {
      close: currentPrice,
      rsi14,
      averagePeriods: KEY_READING_AVERAGES[timeframe],
      shortAverage: sma(closes, KEY_READING_AVERAGES[timeframe][0]),
      longAverage: sma(closes, KEY_READING_AVERAGES[timeframe][1]),
      macd: macdValue.macd,
      macdSignal: macdValue.signal,
    },
  }
}
