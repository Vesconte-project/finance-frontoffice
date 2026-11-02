import type { TrackSpec } from './value-track'

/**
 * The closed template behind "Test a thesis". Every blank is a choice from a short
 * list or a value on a track, so a thesis is always a sentence the product can read
 * back. These are the options the product offers, not claims about any stock.
 */

export type Option<K extends string> = Readonly<{ key: K; text: string; hint: string }>

export const WHO_OPTIONS = [
  { key: 'momentum', text: 'recent winners', hint: 'Stocks that have risen steadily lately.' },
  { key: 'lowvol', text: 'quiet, low-volatility stocks', hint: 'Steady names that swing less than the rest.' },
  { key: 'value', text: 'cheap, profitable companies', hint: 'Low valuation with solid profits.' },
  { key: 'quality', text: 'high-quality companies', hint: 'Strong balance sheets and healthy margins.' },
  { key: 'growth', text: 'fast growers', hint: 'Sales and earnings growing quickly.' },
  { key: 'liquid', text: 'heavily traded stocks', hint: 'Unusually high trading volume.' },
  { key: 'earnings', text: 'companies just after earnings', hint: 'In the days after a report comes out.' },
] as const satisfies readonly Option<string>[]

export const UNIVERSE_OPTIONS = [
  { key: 'picks', text: 'my stocks', hint: 'The ones you choose.' },
  { key: 'watchlist', text: 'my whole watchlist', hint: 'Every stock you follow.' },
  { key: 'covered', text: 'everything we cover', hint: 'Every stock with a ready data snapshot.' },
  { key: 'us', text: 'US stocks', hint: 'Stocks we cover in the US region.' },
  { key: 'eu', text: 'European stocks', hint: 'Stocks we cover in the EU region.' },
  { key: 'apac', text: 'Asia-Pacific stocks', hint: 'Stocks we cover in the APAC region.' },
] as const satisfies readonly Option<string>[]

export const DOES_OPTIONS = [
  { key: 'outperform', text: 'outperform', hint: 'Finish ahead of something you choose, after costs.' },
  { key: 'rise', text: 'go up', hint: 'Simply rise over the period.' },
  { key: 'fall-less', text: 'fall less than', hint: 'Lose less when prices drop.' },
  { key: 'barrier', text: 'reach a gain before a loss', hint: 'Hit a target gain before a stop-loss.' },
] as const satisfies readonly Option<string>[]

export const BENCHMARK_OPTIONS = [
  { key: 'market', text: 'the market', hint: 'S&P 500 (SPY)' },
  { key: 'big-tech', text: 'big tech', hint: 'Nasdaq 100 (QQQ)' },
  { key: 'total-market', text: 'the total market', hint: 'Total US market (VTI)' },
  { key: 'small-caps', text: 'small caps', hint: 'Russell 2000 (IWM)' },
  { key: 'peers', text: 'the rest of my list', hint: 'The other stocks in this test' },
  { key: 'cash', text: 'cash', hint: 'No benchmark, just an absolute result' },
] as const satisfies readonly Option<string>[]

export const CONDITION_OPTIONS = [
  { key: 'any', text: 'in any conditions', hint: 'Always on.' },
  { key: 'falling', text: 'when the market is falling', hint: 'Only in down markets.' },
  { key: 'rising', text: 'when the market is rising', hint: 'Only in up markets.' },
  { key: 'pullback', text: 'after a pullback', hint: 'After a stock drops from a recent high.' },
  { key: 'calm', text: 'in calm markets', hint: 'When market volatility is low.' },
  { key: 'volatile', text: 'when volatility is high', hint: 'When market swings are large.' },
] as const satisfies readonly Option<string>[]

export type WhoKey = (typeof WHO_OPTIONS)[number]['key']
export type UniverseKey = (typeof UNIVERSE_OPTIONS)[number]['key']
export type DoesKey = (typeof DOES_OPTIONS)[number]['key']
export type BenchmarkKey = (typeof BENCHMARK_OPTIONS)[number]['key']
export type ConditionKey = (typeof CONDITION_OPTIONS)[number]['key']

export const HORIZON_TRACK: TrackSpec = { min: 1, max: 120, step: 1, scale: 'log', presets: [5, 10, 20] }
export const GAIN_TRACK: TrackSpec = { min: 1, max: 50, step: 0.5, scale: 'log', presets: [3, 5, 10] }
export const LOSS_TRACK: TrackSpec = { min: 1, max: 50, step: 0.5, scale: 'log', presets: [2, 3, 5] }

export type ThesisSentence = Readonly<{
  who: WhoKey
  universe: UniverseKey
  does: DoesKey
  benchmark: BenchmarkKey
  condition: ConditionKey
  horizons: readonly number[]
  gains: readonly number[]
  losses: readonly number[]
}>

export const DEFAULT_SENTENCE: ThesisSentence = {
  who: 'momentum',
  universe: 'watchlist',
  does: 'outperform',
  benchmark: 'market',
  condition: 'any',
  horizons: [10],
  gains: [5],
  losses: [3],
}

/** Whether the chosen verb compares against something the reader picks. */
export function doesNeedsBenchmark(does: DoesKey): boolean {
  return does === 'outperform' || does === 'fall-less'
}

export function optionText<K extends string>(options: readonly Option<K>[], key: K): string {
  const found = options.find((option) => option.key === key)
  if (!found) throw new Error(`Unknown option: ${key}`)
  return found.text
}

const HORIZON_NAMES: Readonly<Record<number, string>> = { 5: 'a week', 10: 'two weeks', 20: 'a month' }

export function horizonText(days: number): string {
  return HORIZON_NAMES[days] ?? `${days} ${days === 1 ? 'day' : 'days'}`
}

function joinWords(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function horizonsText(days: readonly number[]): string {
  if (days.length === 1) return horizonText(days[0])
  return `${joinWords(days.map(String))} days`
}

export function percentText(value: number, sign: '+' | '−'): string {
  return `${sign}${value}%`
}

function valuesText(values: readonly number[], sign: '+' | '−'): string {
  return values.length === 1 ? percentText(values[0], sign) : joinWords(values.map((v) => percentText(v, sign)))
}

/** The sentence read back, for the summary and for history. */
export function describeThesis(sentence: ThesisSentence): string {
  const who = optionText(WHO_OPTIONS, sentence.who)
  const universe = optionText(UNIVERSE_OPTIONS, sentence.universe)
  const condition = sentence.condition === 'any' ? '' : ` ${optionText(CONDITION_OPTIONS, sentence.condition)}`
  const doesText = optionText(DOES_OPTIONS, sentence.does)
  let does: string
  if (sentence.does === 'barrier') {
    does = `reach a gain of ${valuesText(sentence.gains, '+')} before a loss of ${valuesText(sentence.losses, '−')}`
  } else if (doesNeedsBenchmark(sentence.does)) {
    does = `${doesText} ${optionText(BENCHMARK_OPTIONS, sentence.benchmark)}`
  } else {
    does = doesText
  }
  return `Among ${universe}, ${who} will ${does}${condition} over ${horizonsText(sentence.horizons)}`
}

/**
 * How many separate tests the sentence describes: every combination of the values
 * the reader chose to compare. Settings that do not apply to the chosen verb are
 * not counted.
 */
export function countVariants(sentence: ThesisSentence): number {
  let count = Math.max(1, sentence.horizons.length)
  if (sentence.does === 'barrier') {
    count *= Math.max(1, sentence.gains.length) * Math.max(1, sentence.losses.length)
  }
  return count
}

export function isComparingSeveral(sentence: ThesisSentence): boolean {
  return countVariants(sentence) > 1
}
