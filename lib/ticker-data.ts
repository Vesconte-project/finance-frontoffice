import { cache } from 'react'
import { BackendDataError, fetchBackendJson } from './backend'
import { fetchInDisplayCurrency } from './display-currency-server'

export type MarketQuoteSnapshot = {
  price_basis?: 'raw'
  ticker: string
  name: string | null
  price: number | null
  change: number | null
  changePercent: number | null
  marketCapText: string | null
  asOf: string | null
}

export type MarketStatsSnapshot = {
  price_basis?: 'raw'
  ticker: string
  lastPrice: number | null
  asOfDate: string | null
  volume: number | null
  change1D: number | null
  change1M: number | null
  change3M: number | null
  change1Y: number | null
  return1d: number | null
  return1m: number | null
  return3m: number | null
  return1y: number | null
  vol30dPct: number | null
  week52High: number | null
  week52Low: number | null
  distanceFrom52wHighPct: number | null
  distanceFrom52wLowPct: number | null
  asOf: string | null
}

export type TickerProfileSummary = {
  // Snapshot/as-of value, sourced from report-dated fundamentals.
  marketCap: number | null
  // Latest descriptive metadata is intentionally separate and must not be
  // used for an as-of card or scorecard/model interpretation.
  latestMarketCap: number | null
  latestMarketCapUpdatedAt: string | null
  latestMarketCapSource: 'feature_store.entity_attributes_static' | null
  trailingPe: number | null
}

export type SymbolCoverageRow = {
  ticker: string
  hasMarketData: boolean
  hasPrices: boolean | null
  priceRows: number | null
  technicalRows: number | null
  firstPriceDate: string | null
  lastPriceDate: string | null
  hasTechnicals: boolean | null
  hasFundamentals: boolean
  hasEarnings: boolean
  hasSignals: boolean
  hasScorecard: boolean | null
  marketDataLastDate: string | null
  fundamentalsLastDate: string | null
  nextEarningsDate: string | null
  source: 'coverage_table' | 'inferred'
  updatedAt: string | null
}

export type TickerFundamentalsSummary = {
  ticker: string
  latestRevenue: number | null
  latestEps: number | null
  trailingPe: number | null
  marketCap: number | null
  revenueGrowthYoy: number | null
  earningsGrowthYoy: number | null
  periodEnd: string | null
  currency: string | null
}

export type LatestFundamentalsRow = {
  ticker: string
  metric: string
  metricLabel: string
  valueNumber: number | null
  valueDisplay: string | null
  unit: string | null
  periodEnd: string | null
  asOf: string | null
}

export type NextEarningsRow = {
  ticker: string
  earningsDate: string | null
  earningsTime: string | null
  epsEstimate: number | null
  revenueEstimate: number | null
  fiscalPeriod: string | null
  asOf: string | null
}

export type EarningsHistoryRow = {
  ticker: string
  earningsDate: string | null
  fiscalPeriod: string | null
  epsActual: number | null
  epsEstimate: number | null
  epsSurprisePct: number | null
  revenueActual: number | null
  revenueEstimate: number | null
  revenueSurprisePct: number | null
}

export type TickerPageSummary = {
  ticker: string
  asset?: {
    /** `ticker_registry.instrument_type`: equity, adr, etf, country_fund, index_proxy or unknown. */
    assetType?: string | null
    currency: string | null
    exchange: string | null
    exchangeMic: string | null
    region: string | null
  } | null
  quote: MarketQuoteSnapshot | null
  marketStats: MarketStatsSnapshot | null
  coverage: SymbolCoverageRow
  fundamentalsSummary: TickerFundamentalsSummary | null
  latestFundamentals: LatestFundamentalsRow[]
  nextEarnings: NextEarningsRow | null
  earningsHistory: EarningsHistoryRow[]
  // Page-component coverage only; never use this to decide scorecard visibility.
  componentMissingInputs: string[]
  scorecard?: unknown
  profile?: TickerProfileSummary | null
  /**
   * The listings of the same company we track (finance-backend Entity Layer):
   * `{available, reason, items: [{symbol, exchange, exchangeMic, country,
   * currency, isPrimary, isCurrent}]}`. Absent on an older backend; read it
   * with `parseTrackedListings` (lib/display-currency.ts).
   */
  listings?: unknown
  /**
   * Set when the summary was asked for in a display currency: the amounts
   * stay as reported, with the backend's `money` annotations beside them.
   * `refused` when the backend no longer lists the currency.
   */
  displayCurrency?: { code: string; refused: boolean } | null
}

function normalizeTicker(tickerRaw: string): string {
  return tickerRaw.trim().toUpperCase()
}

async function fetchTickerPageSummaryFromBackend(
  tickerRaw: string,
  currency: string | null = null,
): Promise<TickerPageSummary | null> {
  const ticker = normalizeTicker(tickerRaw)
  if (!ticker) return null

  const { payload, refused } = await fetchInDisplayCurrency(
    `/v1/tickers/${encodeURIComponent(ticker)}/summary`,
    currency,
    (path) => fetchBackendJson<TickerPageSummary | null>(path, { context: 'backend.tickers.summary' }),
  )
  if (!payload || typeof payload !== 'object') return null
  return currency ? { ...payload, displayCurrency: { code: currency, refused } } : payload
}

const cachedTickerSummary = cache(async (ticker: string, currency: string | null): Promise<TickerPageSummary | null> =>
    fetchTickerPageSummaryFromBackend(ticker, currency))

/**
 * The ticker summary, annotated with `currency` conversions when one is chosen. Both
 * arguments always reach the cache, so a call without a currency shares the
 * request's read with one that passes null.
 */
export function getCachedTickerSummary(ticker: string, currency: string | null = null): Promise<TickerPageSummary | null> {
  return cachedTickerSummary(ticker, currency)
}

export async function getTickerCoverage(tickerRaw: string): Promise<SymbolCoverageRow | null> {
  const summary = await fetchTickerPageSummaryFromBackend(tickerRaw)
  return summary?.coverage ?? null
}

export async function getTickerFundamentalsSummary(
  tickerRaw: string
): Promise<TickerFundamentalsSummary | null> {
  const summary = await fetchTickerPageSummaryFromBackend(tickerRaw)
  return summary?.fundamentalsSummary ?? null
}

export async function getTickerLatestFundamentals(tickerRaw: string): Promise<LatestFundamentalsRow[]> {
  const summary = await fetchTickerPageSummaryFromBackend(tickerRaw)
  return summary?.latestFundamentals ?? []
}

export async function getTickerNextEarnings(tickerRaw: string): Promise<NextEarningsRow | null> {
  const summary = await fetchTickerPageSummaryFromBackend(tickerRaw)
  return summary?.nextEarnings ?? null
}

export async function getTickerEarningsHistory(tickerRaw: string): Promise<EarningsHistoryRow[]> {
  const summary = await fetchTickerPageSummaryFromBackend(tickerRaw)
  return summary?.earningsHistory ?? []
}

export async function getTickerPageSummary(tickerRaw: string, currency: string | null = null): Promise<TickerPageSummary> {
  const ticker = normalizeTicker(tickerRaw)
  const summary = await getCachedTickerSummary(ticker, currency)
  if (!summary) {
    throw new BackendDataError('backend.tickers.summary', `No ticker summary payload returned for ${ticker}`)
  }
  return summary
}
