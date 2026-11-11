/**
 * The ticker page's complete price history arrives after the page (ENG-272): it walks its pages
 * one after another. These rules keep the page honest while it is on its way or when it fails:
 * the last year never poses as the complete history.
 */
export type FullHistoryState = 'loading' | 'loaded' | 'incomplete' | 'error'

export function fullHistoryState(result: { status: string; rows: readonly unknown[] } | null, failed: boolean): FullHistoryState {
  if (failed) return 'error'
  if (result === null) return 'loading'
  if (result.status === 'loaded' && result.rows.length > 0) return 'loaded'
  if (result.status === 'empty') return 'incomplete'
  return 'error'
}

/** Ranges that need more than the last year. */
export const LONG_RANGES: readonly string[] = ['5Y', '10Y', 'ALL']

/** What the hero chart must say about a long range it cannot draw completely yet; null when it can. */
export function longRangeNotice(state: FullHistoryState, range: string): string | null {
  if (!LONG_RANGES.includes(range) || state === 'loaded') return null
  if (state === 'loading') return 'Loading the full price history. The chart shows the last year until it arrives.'
  return 'The full price history is unavailable right now. The chart shows the last year only.'
}

/**
 * Weekly and monthly technicals need more than a year of bars. Until the complete history is in,
 * they are computed on the last year of reported prices, and say so.
 */
export function technicalBaseNotice(state: FullHistoryState, timeframe: string): string | null {
  if (state === 'loaded' || timeframe === '1D') return null
  if (state === 'loading') return 'Based on the last year until the full price history loads.'
  return 'Based on the last year only: the full price history is unavailable.'
}

/** The expanded chart offers ALL and long ranges: only over the complete history. */
export function canExpandHistory(state: FullHistoryState, bars: number): boolean {
  return state === 'loaded' && bars >= 2
}

export type ConversionState = 'none' | 'loading' | 'loaded' | 'error'

/** The display-currency message under the chart; null when there is nothing to say. */
export function conversionNotice(state: ConversionState, displayCurrency: string | null, listingCurrency: string): string | null {
  if (!displayCurrency || state === 'none' || state === 'loaded') return null
  if (state === 'loading') return `Converting the chart to ${displayCurrency}. It shows ${listingCurrency} until then.`
  return `The price in ${displayCurrency} could not be loaded. The chart stays in ${listingCurrency}.`
}
