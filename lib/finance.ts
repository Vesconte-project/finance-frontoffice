import { unstable_cache } from 'next/cache'
import { BackendDataError, fetchBackendJson } from './backend'
import {
  normalizeOhlcPayload,
  STOCK_OHLC_CACHE_KEY,
  type OhlcLoadResult,
} from './ohlc-data'
import { getCachedTickerSummary } from './ticker-data'

const FUNDAMENTALS_FRESH_MS = 6 * 60 * 60 * 1000
/** `period_days` maximum for ticker history and OHLC in finance-backend OpenAPI. */
export const BACKEND_HISTORY_PERIOD_DAYS_MAX = 25_000

export interface StockQuote {
  ticker: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap: string
}

export interface PricePoint {
  date: string
  close: number
}

export type { OhlcLoadResult, OhlcPoint } from './ohlc-data'

export interface TickerHolding {
  symbol: string
  name: string
  weightPercent: number | null
}

export interface TickerFinancialRow {
  label: string
  value: string
}

export interface TickerSectorWeight {
  sector: string
  weightPercent: number | null
}

export interface TickerFundamentals {
  about: string | null
  marketCap: string | null
  snapshot: TickerFinancialRow[]
  holdings: TickerHolding[]
  sectorWeights: TickerSectorWeight[]
  dividendRate: string | null
  dividendYield: string | null
  exDividendDate: string | null
  payoutRatio: string | null
  profile: TickerFinancialRow[]
  portfolio: TickerFinancialRow[]
  distributions: TickerFinancialRow[]
  risk: TickerFinancialRow[]
}

interface FormattedValue {
  raw?: number | string | null
  fmt?: string | null
  longFmt?: string | null
}

type FundamentalsSource = 'backend'

export interface RefreshTickerResult {
  ticker: string
  quoteSource: null
  quoteUpdated: boolean
  historicalUpdated: boolean
  fundamentalsSource: FundamentalsSource | null
  fundamentalsUpdated: boolean
  errors: string[]
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function readFormattedValue(value: unknown): FormattedValue | null {
  if (!value || typeof value !== 'object') return null
  return value as FormattedValue
}

function getRawNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$%,]/g, '').trim())
    if (Number.isFinite(parsed)) return parsed
  }
  const formattedValue = readFormattedValue(value)
  if (!formattedValue) return null
  const raw = formattedValue.raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(/[$%,]/g, '').trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getDisplayValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString()
  const formattedValue = readFormattedValue(value)
  if (!formattedValue) return null
  if (typeof formattedValue.fmt === 'string' && formattedValue.fmt.trim()) return formattedValue.fmt.trim()
  if (typeof formattedValue.longFmt === 'string' && formattedValue.longFmt.trim()) {
    return formattedValue.longFmt.trim()
  }
  const raw = formattedValue.raw
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw.toLocaleString()
  return null
}

function formatUnixDateDisplay(rawSeconds: number | null): string | null {
  if (rawSeconds === null || !Number.isFinite(rawSeconds)) return null
  return new Date(rawSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrencyCompact(raw: number | null): string | null {
  if (raw === null || !Number.isFinite(raw)) return null
  if (raw >= 1e12) return `${(raw / 1e12).toFixed(2)}T`
  if (raw >= 1e9) return `${(raw / 1e9).toFixed(2)}B`
  if (raw >= 1e6) return `${(raw / 1e6).toFixed(2)}M`
  return raw.toLocaleString()
}

function formatDollarCompact(raw: number | null): string | null {
  const compact = formatCurrencyCompact(raw)
  if (!compact) return null
  return compact.startsWith('$') ? compact : `$${compact}`
}

function formatNumberCompact(raw: number | null): string | null {
  if (raw === null || !Number.isFinite(raw)) return null
  if (raw >= 1e12) return `${(raw / 1e12).toFixed(2)}T`
  if (raw >= 1e9) return `${(raw / 1e9).toFixed(2)}B`
  if (raw >= 1e6) return `${(raw / 1e6).toFixed(2)}M`
  if (raw >= 1e3) return `${(raw / 1e3).toFixed(2)}K`
  return raw.toLocaleString()
}

function getString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function emptyFundamentals(): TickerFundamentals {
  return {
    about: null,
    marketCap: null,
    snapshot: [],
    holdings: [],
    sectorWeights: [],
    dividendRate: null,
    dividendYield: null,
    exDividendDate: null,
    payoutRatio: null,
    profile: [],
    portfolio: [],
    distributions: [],
    risk: [],
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function hasMeaningfulFundamentalsData(fundamentals: TickerFundamentals): boolean {
  if (fundamentals.about || fundamentals.marketCap) return true
  if (fundamentals.holdings.length > 0 || fundamentals.sectorWeights.length > 0) return true
  if (
    fundamentals.dividendRate ||
    fundamentals.dividendYield ||
    fundamentals.exDividendDate ||
    fundamentals.payoutRatio
  ) {
    return true
  }
  if (
    fundamentals.profile.length > 0 ||
    fundamentals.portfolio.length > 0 ||
    fundamentals.distributions.length > 0 ||
    fundamentals.risk.length > 0
  ) {
    return true
  }
  return fundamentals.snapshot.some((row) => row.value !== '—')
}

function buildPortfolioRows(
  holdings: TickerHolding[],
  sectorWeights: TickerSectorWeight[]
): TickerFinancialRow[] {
  const rows: TickerFinancialRow[] = []
  rows.push({ label: 'Number of Holdings', value: holdings.length.toLocaleString() })

  const top10 = holdings
    .slice()
    .sort((a, b) => (b.weightPercent ?? -1) - (a.weightPercent ?? -1))
    .slice(0, 10)
  const top10Concentration = top10.reduce((acc, item) => acc + (item.weightPercent ?? 0), 0)
  if (top10.length > 0) {
    rows.push({ label: 'Top 10 Concentration', value: `${top10Concentration.toFixed(2)}%` })
    const topHolding = top10[0]
    if (topHolding && topHolding.weightPercent !== null) {
      rows.push({
        label: 'Largest Position',
        value: `${topHolding.symbol} (${topHolding.weightPercent.toFixed(2)}%)`,
      })
    }
  }

  if (sectorWeights.length > 0) {
    rows.push({ label: 'Sector Exposures Available', value: `${sectorWeights.length}` })
    const dominantSector = sectorWeights
      .slice()
      .sort((a, b) => (b.weightPercent ?? -1) - (a.weightPercent ?? -1))[0]
    if (dominantSector && dominantSector.weightPercent !== null) {
      rows.push({
        label: 'Largest Sector',
        value: `${dominantSector.sector} (${dominantSector.weightPercent.toFixed(2)}%)`,
      })
    }
  }
  return rows
}

function formatBackendPercent(raw: number | null): string | null {
  if (raw === null || !Number.isFinite(raw)) return null
  return `${raw.toFixed(2)}%`
}

function formatBackendMoney(raw: number | null): string | null {
  if (raw === null || !Number.isFinite(raw)) return null
  if (Math.abs(raw) < 1000) return `$${raw.toFixed(2)}`
  return formatDollarCompact(raw)
}

function formatBackendDate(value: unknown): string | null {
  const direct = getString(value)
  if (direct) {
    const parsed = Date.parse(direct)
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return direct
  }

  const numeric = getRawNumber(value)
  if (numeric === null) return null
  if (numeric > 10_000_000_000) return new Date(numeric).toISOString().slice(0, 10)
  return formatUnixDateDisplay(numeric)
}

function formatBackendRowValue(label: string, value: unknown): string | null {
  const display = getDisplayValue(value)
  const raw = getRawNumber(value)
  const normalized = label.toLowerCase()

  if (/date|inception/.test(normalized)) return formatBackendDate(value)
  if (/yield|ratio|return|distance|expense|turnover|percent|pct/.test(normalized)) {
    return display?.includes('%') ? display : formatBackendPercent(raw)
  }
  if (/market cap|assets|dividend rate|annual dividend/.test(normalized)) {
    return display?.startsWith('$') ? display : formatBackendMoney(raw)
  }
  if (/shares|holdings|exposures/.test(normalized)) {
    return raw !== null ? formatNumberCompact(raw) : display
  }
  if (/high|low|price|p\/e|pe|beta/.test(normalized)) {
    return raw !== null ? raw.toFixed(2) : display
  }

  return display
}

function parseBackendFinancialRows(value: unknown): TickerFinancialRow[] {
  return asArray(value)
    .map((item): TickerFinancialRow | null => {
      const row = asRecord(item)
      if (!row) return null
      const label = getString(row.label) ?? getString(row.key)
      if (!label) return null
      const rowValue = formatBackendRowValue(label, row.value)
      if (!rowValue) return null
      return { label, value: rowValue }
    })
    .filter((row): row is TickerFinancialRow => row !== null)
}

function parseBackendHoldings(value: unknown): TickerHolding[] {
  return asArray(value)
    .map((item): TickerHolding | null => {
      const row = asRecord(item)
      if (!row) return null
      const symbol = getString(row.symbol) ?? getString(row.ticker)
      const name = getString(row.name) ?? getString(row.companyName) ?? symbol
      if (!symbol && !name) return null
      const weight = getRawNumber(row.weightPercent ?? row.weight ?? row.weight_pct)
      return {
        symbol: symbol ?? name ?? 'Unknown',
        name: name ?? symbol ?? 'Unknown',
        weightPercent: weight !== null ? Number(weight.toFixed(4)) : null,
      }
    })
    .filter((row): row is TickerHolding => row !== null)
}

function parseBackendSectorWeights(value: unknown): TickerSectorWeight[] {
  return asArray(value)
    .map((item): TickerSectorWeight | null => {
      const row = asRecord(item)
      if (!row) return null
      const sector = getString(row.sector) ?? getString(row.name)
      if (!sector) return null
      const weight = getRawNumber(row.weightPercent ?? row.weight ?? row.weight_pct)
      return {
        sector,
        weightPercent: weight !== null ? Number(weight.toFixed(4)) : null,
      }
    })
    .filter((row): row is TickerSectorWeight => row !== null)
}

function firstBackendRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    const record = asRecord(value)
    if (record) return record
  }
  return null
}

function firstBackendValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return null
}

function ensureProfileIdentityRows(
  profileRows: TickerFinancialRow[],
  ticker: string,
  name: string | null,
  marketCap: string | null
): TickerFinancialRow[] {
  const rows = [...profileRows]
  if (!rows.some((row) => row.label === 'Symbol')) rows.unshift({ label: 'Symbol', value: ticker })
  if (name && !rows.some((row) => row.label === 'Name')) rows.splice(1, 0, { label: 'Name', value: name })
  if (marketCap && !rows.some((row) => row.label === 'Market Cap')) {
    rows.push({ label: 'Market Cap', value: marketCap })
  }
  return rows
}

function buildFallbackFundamentalsFromBackendSummary(summary: Awaited<ReturnType<typeof getCachedTickerSummary>>): TickerFundamentals {
  const fallback = emptyFundamentals()
  if (!summary) return fallback

  const rows = Array.isArray(summary.latestFundamentals) ? summary.latestFundamentals : []
  fallback.snapshot = rows
    .map((row) => {
      const label = typeof row?.metricLabel === 'string' && row.metricLabel.trim() ? row.metricLabel : null
      const valueDisplay = typeof row?.valueDisplay === 'string' && row.valueDisplay.trim() ? row.valueDisplay : null
      const valueNumber = typeof row?.valueNumber === 'number' && Number.isFinite(row.valueNumber) ? row.valueNumber : null
      if (!label) return null
      return {
        label,
        value:
          formatBackendRowValue(label, valueDisplay ?? valueNumber) ??
          (valueNumber !== null ? String(valueNumber) : '—'),
      }
    })
    .filter((row): row is TickerFinancialRow => row !== null)
    .slice(0, 10)

  const marketCapNumber = summary.fundamentalsSummary?.marketCap ?? null
  const quoteMarketCapText =
    typeof summary.quote?.marketCapText === 'string' && summary.quote.marketCapText.trim()
      ? summary.quote.marketCapText
      : null
  fallback.marketCap =
    formatBackendMoney(getRawNumber(quoteMarketCapText)) ??
    quoteMarketCapText ??
    formatBackendMoney(marketCapNumber)
  fallback.profile = ensureProfileIdentityRows(
    [],
    summary.ticker,
    summary.quote?.name ?? null,
    fallback.marketCap
  )
  return fallback
}

function normalizeBackendProfilePayload(
  payload: unknown,
  summary: Awaited<ReturnType<typeof getCachedTickerSummary>>,
  ticker: string
): TickerFundamentals | null {
  const record = firstBackendRecord(
    payload,
    asRecord(payload)?.profilePayload,
    asRecord(payload)?.fundamentals,
    asRecord(payload)?.tickerProfile
  )
  if (!record) return null

  const holdings = parseBackendHoldings(record.holdings)
  const sectorWeights = parseBackendSectorWeights(record.sectorWeights ?? record.sector_weights)
  const marketCap = formatBackendMoney(getRawNumber(firstBackendValue(record, ['marketCap', 'market_cap'])))
  const dividendRate = formatBackendMoney(getRawNumber(firstBackendValue(record, ['dividendRate', 'dividend_rate'])))
  const dividendYield = formatBackendPercent(getRawNumber(firstBackendValue(record, ['dividendYield', 'dividend_yield'])))
  const exDividendDate = formatBackendDate(firstBackendValue(record, ['exDividendDate', 'ex_dividend_date']))
  const payoutRatio = formatBackendPercent(getRawNumber(firstBackendValue(record, ['payoutRatio', 'payout_ratio'])))
  const profileRows = parseBackendFinancialRows(record.profile)
  const portfolioRows = parseBackendFinancialRows(record.portfolio)
  const distributions = parseBackendFinancialRows(record.distributions)
  const risk = parseBackendFinancialRows(record.risk)

  const fundamentals: TickerFundamentals = {
    about:
      getString(record.about) ??
      getString(record.description) ??
      getString(record.longBusinessSummary) ??
      null,
    marketCap:
      marketCap ??
      (typeof summary?.quote?.marketCapText === 'string' && summary.quote.marketCapText.trim()
        ? summary.quote.marketCapText
        : null),
    snapshot: parseBackendFinancialRows(record.snapshot),
    holdings,
    sectorWeights,
    dividendRate,
    dividendYield,
    exDividendDate,
    payoutRatio,
    profile: ensureProfileIdentityRows(
      profileRows,
      ticker,
      summary?.quote?.name ?? null,
      marketCap
    ),
    portfolio: portfolioRows.length > 0 ? portfolioRows : buildPortfolioRows(holdings, sectorWeights),
    distributions,
    risk,
  }

  return fundamentals
}

async function fetchBackendTickerProfile(ticker: string): Promise<unknown | null> {
  try {
    return await fetchBackendJson<unknown>(`/tickers/${encodeURIComponent(ticker)}/profile`, {
      context: 'backend.tickers.profile',
      init: {
        cache: 'force-cache',
        next: {
          revalidate: FUNDAMENTALS_FRESH_MS / 1000,
          tags: [`ticker-profile:${ticker}`],
        },
      },
    })
  } catch (error) {
    if (error instanceof BackendDataError) {
      if (error.status !== 404 && error.status !== 422) {
        console.warn(`Backend profile unavailable for ${ticker}; using summary fundamentals only.`)
      }
      return null
    }
    throw error
  }
}

async function loadQuote(tickerRaw: string): Promise<StockQuote | null> {
  const ticker = normalizeTicker(tickerRaw)
  const summary = await getCachedTickerSummary(ticker)
  const quote = summary?.quote
  if (!quote) return null
  const price = typeof quote.price === 'number' ? quote.price : null
  if (price === null) return null
  return {
    ticker,
    name: typeof quote.name === 'string' && quote.name.trim() ? quote.name : ticker,
    price,
    change: typeof quote.change === 'number' ? quote.change : 0,
    changePercent: typeof quote.changePercent === 'number' ? quote.changePercent : 0,
    marketCap: typeof quote.marketCapText === 'string' && quote.marketCapText.trim() ? quote.marketCapText : 'N/A',
  }
}

async function loadHistorical(tickerRaw: string, periodDays: number): Promise<PricePoint[]> {
  const ticker = normalizeTicker(tickerRaw)
  const safeDays = Number.isFinite(periodDays) && periodDays > 0
    ? Math.max(30, Math.min(periodDays, BACKEND_HISTORY_PERIOD_DAYS_MAX))
    : 0
  const payload = await fetchBackendJson<Array<{ date?: string; close?: number }>>(
    `/tickers/${encodeURIComponent(ticker)}/history?period_days=${safeDays}`,
    { context: 'backend.tickers.history' }
  )
  if (!Array.isArray(payload)) return []
  return payload
    .map((row) => {
      const date = typeof row?.date === 'string' ? row.date : null
      const close = typeof row?.close === 'number' ? row.close : null
      if (!date || close === null || !Number.isFinite(close)) return null
      return { date, close: Number(close.toFixed(2)) }
    })
    .filter((point): point is PricePoint => point !== null)
}

async function loadOhlc(
  tickerRaw: string,
  periodDays: number,
  coverageExpectsPrices: boolean
): Promise<OhlcLoadResult> {
  const ticker = normalizeTicker(tickerRaw)
  const safeDays = Number.isFinite(periodDays) && periodDays > 0
    ? Math.max(30, Math.min(periodDays, BACKEND_HISTORY_PERIOD_DAYS_MAX))
    : 0
  const payload = await fetchBackendJson<unknown>(
    `/tickers/${encodeURIComponent(ticker)}/ohlc?period_days=${safeDays}`,
    { context: 'backend.tickers.ohlc' }
  )
  return normalizeOhlcPayload(payload, { coverageExpectsPrices })
}

async function loadTickerFundamentals(tickerRaw: string): Promise<TickerFundamentals> {
  const ticker = normalizeTicker(tickerRaw)
  const summary = await getCachedTickerSummary(ticker)
  if (!summary) {
    return emptyFundamentals()
  }

  const embeddedProfile = normalizeBackendProfilePayload(summary.profile, summary, ticker)
  if (embeddedProfile && hasMeaningfulFundamentalsData(embeddedProfile)) {
    return embeddedProfile
  }

  const remoteProfilePayload = await fetchBackendTickerProfile(ticker)
  const remoteProfile = normalizeBackendProfilePayload(remoteProfilePayload, summary, ticker)
  if (remoteProfile && hasMeaningfulFundamentalsData(remoteProfile)) {
    return remoteProfile
  }

  return buildFallbackFundamentalsFromBackendSummary(summary)
}

export async function refreshTickerMarketData(
  tickerRaw: string,
  _periodDays: number = 120
): Promise<RefreshTickerResult> {
  const ticker = normalizeTicker(tickerRaw)
  const quote = await loadQuote(ticker)
  const historical = await loadHistorical(ticker, Math.max(1, _periodDays))
  const fundamentals = await loadTickerFundamentals(ticker)
  return {
    ticker,
    quoteSource: null,
    quoteUpdated: quote !== null,
    historicalUpdated: historical.length > 0,
    fundamentalsSource: hasMeaningfulFundamentalsData(fundamentals) ? 'backend' : null,
    fundamentalsUpdated: Boolean(fundamentals.snapshot.length || fundamentals.profile.length),
    errors: [],
  }
}

export const getStockQuote = unstable_cache(
  async (ticker: string): Promise<StockQuote | null> => loadQuote(ticker),
  ['stock-quote-cache-v2'],
  { revalidate: 60 }
)

export const getHistoricalData = unstable_cache(
  async (ticker: string, periodDays: number = 30): Promise<PricePoint[]> =>
    loadHistorical(ticker, periodDays),
  ['stock-historical-cache-v2'],
  { revalidate: 3600 }
)

export const getOhlcData = unstable_cache(
  async (
    ticker: string,
    periodDays: number = 1825,
    coverageExpectsPrices: boolean = false
  ): Promise<OhlcLoadResult> => loadOhlc(ticker, periodDays, coverageExpectsPrices),
  [STOCK_OHLC_CACHE_KEY],
  { revalidate: 3600 }
)

export const getTickerFundamentals = unstable_cache(
  async (ticker: string): Promise<TickerFundamentals> => loadTickerFundamentals(ticker),
  ['stock-fundamentals-cache-v6'],
  { revalidate: 21600 }
)
