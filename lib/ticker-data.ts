import { unstable_cache } from 'next/cache'
import { BackendDataError, fetchBackendJson } from './backend'

export type MarketQuoteSnapshot = {
  ticker: string
  name: string | null
  price: number | null
  change: number | null
  changePercent: number | null
  marketCapText: string | null
  asOf: string | null
}

export type MarketStatsSnapshot = {
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
}

function normalizeTicker(tickerRaw: string): string {
  return tickerRaw.trim().toUpperCase()
}

async function fetchTickerPageSummaryFromBackend(tickerRaw: string): Promise<TickerPageSummary | null> {
  const ticker = normalizeTicker(tickerRaw)
  if (!ticker) return null

  const payload = await fetchBackendJson<TickerPageSummary | null>(
    `/tickers/${encodeURIComponent(ticker)}/summary`,
    { context: 'backend.tickers.summary' }
  )
  return payload && typeof payload === 'object' ? payload : null
}

export const getCachedTickerSummary = unstable_cache(
  async (ticker: string): Promise<TickerPageSummary | null> =>
    fetchTickerPageSummaryFromBackend(ticker),
  ['ticker-page-summary-v2'],
  { revalidate: 120 }
)

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

export async function getTickerPageSummary(tickerRaw: string): Promise<TickerPageSummary> {
  const ticker = normalizeTicker(tickerRaw)
  const summary = await getCachedTickerSummary(ticker)
  if (!summary) {
    throw new BackendDataError('backend.tickers.summary', `No ticker summary payload returned for ${ticker}`)
  }
  return summary
}
