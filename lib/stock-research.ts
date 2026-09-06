import 'server-only'

import { currencyForTicker, formatCompactMoney } from '@/lib/currency'
import {
  getTickerFundamentals,
  type TickerFinancialRow,
  type TickerFundamentals,
} from '@/lib/finance'
import {
  getTickerPageSummary,
  type LatestFundamentalsRow,
  type TickerPageSummary,
} from '@/lib/ticker-data'
import { stockAssetKind, type StockAssetKind } from '@/lib/stock-asset-kind'

export type ResearchAssetKind = StockAssetKind

export type ResearchMetric = {
  key: string
  label: string
  value: string
  period: string | null
  unit: string | null
}

export type ResearchTheme = {
  key: string
  label: string
  metrics: ResearchMetric[]
}

export type StockResearchData = {
  ticker: string
  name: string
  kind: ResearchAssetKind
  currency: string
  summary: TickerPageSummary
  fundamentals: TickerFundamentals
  description: string | null
  profileFacts: TickerFinancialRow[]
  identifiers: TickerFinancialRow[]
  themes: ResearchTheme[]
  coverageLabel: 'Available' | 'Partial coverage'
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Identity for de-duplication, which `normalizeLabel` cannot be: it keeps the
 * separators as spaces, so `trailing_pe` became `trailing pe` and `Trailing
 * P/E` became `trailing p e`. The same metric arrived by two paths and never
 * collided, and the page printed it twice. Dropping separators entirely makes
 * both resolve to one key. Kept separate from `normalizeLabel` because the
 * theme matchers below are written with spaces in them.
 */
function dedupeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Acronyms arrive as snake_case keys that have been title-cased upstream, so
// the page showed `Eps` and `Ebitda`. Repaired word-wise rather than by
// rewriting whole labels, so a label the backend spells properly is untouched.
const ACRONYMS = new Map(
  ['eps', 'ebitda', 'ebit', 'roe', 'roa', 'roic', 'roce', 'pe', 'peg', 'ev', 'fcf', 'nav', 'aum', 'ttm', 'yoy', 'usd']
    .map((word) => [word, word.toUpperCase()]),
)

function repairLabel(value: string): string {
  return value
    .split(' ')
    .map((word) => ACRONYMS.get(word.toLowerCase()) ?? word)
    .join(' ')
}

function formatMetricValue(row: LatestFundamentalsRow, currency: string): string | null {
  const display = row.valueDisplay?.trim()
  const value = row.valueNumber
  if (value === null || !Number.isFinite(value)) return display || null

  const label = normalizeLabel(`${row.metric} ${row.metricLabel}`)
  if (/(yield|margin|growth|return on|\broe\b|\broa\b|payout|percent|pct)/.test(label)) {
    const scaled = Math.abs(value) <= 1.5 ? value * 100 : value
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(scaled)}%`
  }
  if (/(market cap|revenue|sales|ebitda|cash|debt|asset|liabilit|equity|income|cash flow|free cash flow|enterprise value|profit)/.test(label)) {
    return formatCompactMoney(value, currency)
  }
  // `display` last, not first: the backend sends full precision in it, so a
  // trailing P/E rendered as 37.681973 on a page of two-decimal figures.
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function latestMetrics(rows: LatestFundamentalsRow[], currency: string): ResearchMetric[] {
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    const key = normalizeLabel(row.metric || row.metricLabel)
    const identity = dedupeKey(row.metric || row.metricLabel)
    const value = formatMetricValue(row, currency)
    if (!key || seen.has(identity) || !value || value === '—') return []
    seen.add(identity)
    return [{
      key,
      label: repairLabel(row.metricLabel || row.metric),
      value,
      period: row.periodEnd,
      unit: row.unit,
    }]
  })
}

function appendFormattedRows(metrics: ResearchMetric[], rows: TickerFinancialRow[]): ResearchMetric[] {
  const seen = new Set(metrics.map((row) => dedupeKey(row.key)))
  const next = [...metrics]
  for (const row of rows) {
    const key = normalizeLabel(row.label)
    const identity = dedupeKey(row.label)
    if (!key || seen.has(identity) || !row.value || row.value === '—') continue
    seen.add(identity)
    next.push({ key, label: repairLabel(row.label), value: row.value, period: null, unit: null })
  }
  return next
}

function buildThemes(
  kind: ResearchAssetKind,
  latestRows: LatestFundamentalsRow[],
  fundamentals: TickerFundamentals,
  currency: string,
): ResearchTheme[] {
  let metrics = latestMetrics(latestRows, currency)
  metrics = appendFormattedRows(metrics, fundamentals.snapshot)
  metrics = appendFormattedRows(metrics, fundamentals.portfolio)
  metrics = appendFormattedRows(metrics, fundamentals.distributions)
  metrics = appendFormattedRows(metrics, fundamentals.risk)
  if (fundamentals.dividendYield) metrics = appendFormattedRows(metrics, [{ label: 'Dividend yield', value: fundamentals.dividendYield }])
  if (fundamentals.dividendRate) metrics = appendFormattedRows(metrics, [{ label: 'Dividend rate', value: fundamentals.dividendRate }])
  if (fundamentals.payoutRatio) metrics = appendFormattedRows(metrics, [{ label: 'Payout ratio', value: fundamentals.payoutRatio }])
  if (fundamentals.exDividendDate) metrics = appendFormattedRows(metrics, [{ label: 'Ex-dividend date', value: fundamentals.exDividendDate }])

  metrics = metrics.filter((metric) => {
    const label = normalizeLabel(`${metric.key} ${metric.label}`)
    if (/(day high|day low|52w high|52w low|52 week|distance from|return 1d|return 1m|return 3m|return 1y|last price|volume)/.test(label)) {
      return false
    }
    if (kind === 'equity' && /(number of holdings|shares outstanding|beta)/.test(label)) return false
    return true
  })

  const definitions = kind === 'fund'
    ? [
        { key: 'portfolio', label: 'Portfolio', matcher: /(holding|portfolio|asset|fund family|category|inception)/i },
        { key: 'exposure', label: 'Exposure', matcher: /(sector|industry|geograph|country|exposure|concentration)/i },
        { key: 'valuation', label: 'Valuation', matcher: /(valuation|price.*book|price.*sales|\bp(?:\/| )?e\b|trailing pe|forward pe|multiple|market cap|net asset)/i },
        { key: 'distributions', label: 'Distributions', matcher: /(distribution|dividend|yield|payout|ex date)/i },
        { key: 'risk', label: 'Risk', matcher: /(risk|beta|volatility|drawdown|turnover|expense|duration)/i },
      ]
    : [
        { key: 'valuation', label: 'Valuation', matcher: /(market cap|enterprise|valuation|price.*book|price.*sales|\bp(?:\/| )?e\b|trailing pe|forward pe|multiple)/i },
        { key: 'growth', label: 'Growth', matcher: /(growth|revenue|sales|earnings|eps|net income|cash flow)/i },
        { key: 'profitability', label: 'Profitability', matcher: /(margin|profit|ebitda|operating income|return on|roe|roa)/i },
        { key: 'financial-health', label: 'Financial health', matcher: /(cash|debt|asset|liabilit|equity|liquidity|current ratio|quick ratio|solvency)/i },
        { key: 'shareholder-return', label: 'Shareholder return', matcher: /(dividend|distribution|yield|payout|ex date|buyback)/i },
      ]

  const claimed = new Set<string>()
  const themes = definitions.map((definition) => {
    const matching = metrics.filter((metric) => {
      if (claimed.has(metric.key) || !definition.matcher.test(`${metric.key} ${metric.label}`)) return false
      claimed.add(metric.key)
      return true
    })
    return { key: definition.key, label: definition.label, metrics: matching }
  })

  const other = metrics.filter((metric) => !claimed.has(metric.key))
  if (other.length > 0) themes.push({ key: 'other', label: kind === 'fund' ? 'Fund details' : 'Additional evidence', metrics: other })
  return themes
}

function splitProfileRows(rows: TickerFinancialRow[]): {
  profileFacts: TickerFinancialRow[]
  identifiers: TickerFinancialRow[]
} {
  const identity = /^(symbol|ticker|name|company name|market cap)$/i
  const identifier = /(isin|cusip|sedol|figi|lei|identifier)/i
  const profileFacts: TickerFinancialRow[] = []
  const identifiers: TickerFinancialRow[] = []
  for (const row of rows) {
    if (identity.test(row.label)) continue
    if (identifier.test(row.label)) identifiers.push(row)
    else profileFacts.push(row)
  }
  return { profileFacts, identifiers }
}

export async function getStockResearchData(tickerRaw: string): Promise<StockResearchData> {
  const ticker = tickerRaw.trim().toUpperCase()
  const [summary, fundamentals] = await Promise.all([
    getTickerPageSummary(ticker),
    getTickerFundamentals(ticker),
  ])
  const name = summary.quote?.name?.trim() || ticker
  const kind = stockAssetKind({ ticker, name, latestFundamentals: summary.latestFundamentals })
  const currency = summary.fundamentalsSummary?.currency || currencyForTicker(ticker)
  const { profileFacts, identifiers } = splitProfileRows(fundamentals.profile)
  const hasProfileEvidence = Boolean(
    fundamentals.about ||
      profileFacts.length ||
      fundamentals.holdings.length ||
      fundamentals.sectorWeights.length,
  )

  return {
    ticker,
    name,
    kind,
    currency,
    summary,
    fundamentals,
    description: fundamentals.about,
    profileFacts,
    identifiers,
    themes: buildThemes(kind, summary.latestFundamentals, fundamentals, currency),
    coverageLabel:
      summary.coverage.hasFundamentals && hasProfileEvidence && Boolean(fundamentals.about)
        ? 'Available'
        : 'Partial coverage',
  }
}
