import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'
import StockOverviewClient from '@/components/stocks/StockOverviewClient'
import {
  backendErrorDetails,
  runWithBackendRequestLogContext,
  type BackendRequestLogContext,
} from '@/lib/backend-request-log'
import { BackendDataError } from '@/lib/backend'
import { currencyForTicker, formatCompactMoney, formatMoney } from '@/lib/currency'
import {
  getOhlcData,
  getStockQuote,
  getTickerFundamentals,
  type TickerFinancialRow,
  type TickerFundamentals,
} from '@/lib/finance'
import {
  ohlcBackendFailureResult,
  ohlcMalformedResult,
  OhlcPayloadError,
  STOCK_OHLC_CACHE_KEY,
  type OhlcLoadResult,
} from '@/lib/ohlc-data'
import {
  getTickerRelationships,
  rankTickerRelationshipCandidates,
  type TickerRelationships,
} from '@/lib/relationships'
import { getCachedLatestScreenerRow, getCachedSignalHistoryForTicker } from '@/lib/signals'
import {
  getTickerPageSummary,
  type LatestFundamentalsRow,
  type SymbolCoverageRow,
} from '@/lib/ticker-data'
import { scorecardFromTickerSummary } from '@/lib/ticker-page-scorecard'
import { canonicalTickerStats } from '@/lib/ticker-page-stats'
import { stockAssetKind } from '@/lib/stock-asset-kind'

export const dynamic = 'force-dynamic'

function singleSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}

function sanitizeScreenerSignal(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed.slice(0, 48)
}

function sanitizeModelName(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed.slice(0, 72)
}

function stockEntrySourceFromContext(
  value: string | null
): 'homepage_sample' | 'models_hub' | 'stock_page' | 'screener' | 'compare' | 'direct' {
  if (value === 'screener') return 'screener'
  if (value === 'model' || value === 'stock_page') return 'stock_page'
  if (value === 'homepage_sample') return 'homepage_sample'
  if (value === 'models_hub') return 'models_hub'
  if (value === 'compare') return 'compare'
  if (value === 'direct') return 'direct'
  return 'direct'
}

function parseCompactCurrencyNumber(value: string | null): number | null {
  if (!value) return null
  const normalized = value
    .replace(/[$€£₹¥]/g, '')
    .replace(/\b(?:USD|EUR|GBP|GBp|GBX|AUD|HKD|INR|JPY|DKK|SEK|NOK|kr)\b/gi, '')
    .replace(/,/g, '')
    .trim()
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/i)
  if (!match) return null

  const numeric = Number(match[1])
  if (!Number.isFinite(numeric)) return null

  const suffix = match[2]?.toUpperCase()
  if (suffix === 'T') return numeric * 1_000_000_000_000
  if (suffix === 'B') return numeric * 1_000_000_000
  if (suffix === 'M') return numeric * 1_000_000
  if (suffix === 'K') return numeric * 1_000
  return numeric
}

type FundamentalGroup = {
  key: string
  label: string
  rows: Array<{ label: string; value: string }>
}

function normalizeFundamentalLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function formatFundamentalValue(label: string, rawValue: string | number, currency: string): string {
  const text = String(rawValue).trim()
  if (!text || text === '—') return '—'

  const normalizedLabel = normalizeFundamentalLabel(label)
  if (/date|inception/.test(normalizedLabel)) {
    const parsedDate = Date.parse(text)
    if (Number.isFinite(parsedDate)) {
      return new Date(parsedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
  }

  if (!/^-?\d[\d,]*(?:\.\d+)?$/.test(text)) return text
  const numeric = Number.parseFloat(text.replace(/,/g, ''))
  if (!Number.isFinite(numeric)) return text

  const isPercent = /(yield|margin|growth|return on|\broe\b|\broa\b|percent|pct|payout)/.test(normalizedLabel)
  if (isPercent) {
    const scaled = Math.abs(numeric) <= 1.5 ? numeric * 100 : numeric
    return `${scaled.toFixed(2)}%`
  }

  const isCurrency = /(market cap|revenue|sales|ebitda|cash|debt|assets|equity|income|flow|fcf|enterprise value|liabilit|profit)/.test(normalizedLabel)
  if (isCurrency && Math.abs(numeric) >= 1_000) return formatCompactMoney(numeric, currency)

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric)
}

function usableFinancialRows(
  latestRows: LatestFundamentalsRow[],
  fundamentals: TickerFundamentals | null,
  currency: string
): TickerFinancialRow[] {
  const rows: TickerFinancialRow[] = [
    ...latestRows.map((row) => ({
      label: row.metricLabel,
      value: formatFundamentalValue(
        row.metricLabel,
        row.valueNumber ?? row.valueDisplay ?? '—',
        currency
      ),
    })),
    ...(fundamentals?.snapshot ?? []),
    ...(fundamentals?.profile ?? []),
    ...(fundamentals?.portfolio ?? []),
    ...(fundamentals?.distributions ?? []),
    ...(fundamentals?.risk ?? []),
  ]
  if (fundamentals?.dividendYield) rows.push({ label: 'Dividend yield', value: fundamentals.dividendYield })
  if (fundamentals?.dividendRate) rows.push({ label: 'Dividend rate', value: fundamentals.dividendRate })
  if (fundamentals?.payoutRatio) rows.push({ label: 'Payout ratio', value: fundamentals.payoutRatio })
  if (fundamentals?.exDividendDate) rows.push({ label: 'Ex-dividend date', value: fundamentals.exDividendDate })

  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = normalizeFundamentalLabel(row.label)
    if (!key || seen.has(key) || !row.value || row.value === '—') return false
    if (/^(symbol|ticker|name|company name)$/.test(key)) return false
    seen.add(key)
    return true
  }).map((row) => ({
    label: row.label,
    value: formatFundamentalValue(row.label, row.value, currency),
  }))
}

function buildFundamentalGroups(
  latestRows: LatestFundamentalsRow[],
  fundamentals: TickerFundamentals | null,
  currency: string
): FundamentalGroup[] {
  const rows = usableFinancialRows(latestRows, fundamentals, currency)
  const definitions: Array<{ key: string; label: string; matcher: RegExp }> = [
    { key: 'valuation', label: 'Valuation', matcher: /(market cap|enterprise|valuation|price.*book|price.*sales|\bp\/?e\b|trailing pe|forward pe|multiple)/i },
    { key: 'growth-income', label: 'Growth and income', matcher: /(growth|revenue|sales|earnings|\beps\b|net income|cash flow)/i },
    { key: 'profitability', label: 'Profitability', matcher: /(margin|profit|ebitda|return on|\broe\b|\broa\b)/i },
    { key: 'balance-sheet', label: 'Balance sheet', matcher: /(cash|debt|asset|liabilit|equity|liquidity|current ratio|quick ratio)/i },
    { key: 'dividends', label: 'Dividends', matcher: /(dividend|distribution|yield|payout|ex date)/i },
    { key: 'fund', label: 'Fund information', matcher: /(expense|turnover|inception|fund family|net assets|category)/i },
  ]

  return definitions
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      rows: rows.filter((row) => definition.matcher.test(normalizeFundamentalLabel(row.label))).slice(0, 10),
    }))
    .filter((group) => group.rows.length > 0)
}

function emptyRelationships(ticker: string, window: number): TickerRelationships {
  return {
    asOf: null,
    ticker,
    window,
    node: null,
    nodes: [],
    marketCoMovers: [],
    residualCoMovers: [],
    leadLag: {
      followers: [],
      leaders: [],
    },
    probableSpurious: [],
    themePeers: [],
  }
}

function detectNavigationMode(requestHeaders: Headers): string {
  if (requestHeaders.get('next-router-prefetch')) return 'soft-prefetch'
  if (requestHeaders.get('rsc') === '1' || requestHeaders.has('next-router-state-tree')) {
    return 'soft-navigation'
  }
  if ((requestHeaders.get('accept') || '').includes('text/html')) return 'full-request'
  return 'unknown'
}

function logStockPageEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: BackendRequestLogContext,
  details: Record<string, unknown> = {}
): void {
  const payload = {
    ticker: context.ticker,
    requestId: context.requestId,
    navigationMode: context.navigationMode,
    ...details,
  }
  if (level === 'error') {
    console.error(`[stock-page] ${message}`, payload)
    return
  }
  if (level === 'warn') {
    console.warn(`[stock-page] ${message}`, payload)
    return
  }
  console.info(`[stock-page] ${message}`, payload)
}

async function loadOptionalStockDataset<T>(
  context: BackendRequestLogContext,
  endpoint: string,
  fallback: T,
  loader: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now()
  try {
    return await loader()
  } catch (error) {
    const details = backendErrorDetails(error)
    logStockPageEvent('error', 'optional dataset unavailable', context, {
      endpoint,
      durationMs: Date.now() - startedAt,
      error: details.message,
      aborted: details.aborted,
      timeout: details.timeout,
    })
    return fallback
  }
}

function coverageExpectsPrices(coverage: SymbolCoverageRow): boolean {
  return coverage.hasPrices === true || (typeof coverage.priceRows === 'number' && coverage.priceRows > 0)
}

async function loadStockOhlcDataset(
  context: BackendRequestLogContext,
  coverage: SymbolCoverageRow
): Promise<OhlcLoadResult> {
  const expectsPrices = coverageExpectsPrices(coverage)

  try {
    return await getOhlcData(context.ticker, 3650, expectsPrices)
  } catch (error) {
    const details = backendErrorDetails(error)
    const result =
      error instanceof OhlcPayloadError
        ? error.result
        : error instanceof BackendDataError && error.status === 200
          ? ohlcMalformedResult({
              reason: details.message,
              backendStatus: error.status,
            })
        : ohlcBackendFailureResult({
            reason: details.message,
            backendStatus: error instanceof BackendDataError ? error.status : null,
          })

    const logLevel = expectsPrices ? 'warn' : 'error'
    logStockPageEvent(logLevel, 'ohlc dataset unavailable', context, {
      endpoint: `/tickers/${context.ticker}/ohlc?period_days=3650`,
      coverageHasPrices: coverage.hasPrices,
      coveragePriceRows: coverage.priceRows,
      coverageFirstPriceDate: coverage.firstPriceDate,
      coverageLastPriceDate: coverage.lastPriceDate,
      ohlcStatus: result.status,
      ohlcReason: result.reason,
      ohlcRawRows: result.rawRows,
      ohlcValidRows: result.validRows,
      cacheKey: result.cacheKey,
      expectedCacheKey: STOCK_OHLC_CACHE_KEY,
      backendStatus: result.backendStatus,
      error: details.message,
      aborted: details.aborted,
      timeout: details.timeout,
    })

    return result
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>
}): Promise<Metadata> {
  const resolvedParams = await params
  const ticker = resolvedParams.ticker.toUpperCase()
  const quote = await getStockQuote(ticker).catch(() => null)
  const name = quote?.name || ticker

  return {
    title: `${ticker} Markets Signal, Research & Overview - Longbrunch`,
    description: `Explore price history, available signals, scorecard context, fundamentals, and asset relationships for ${name} (${ticker}).`,
  }
}

export default async function TickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{
    from?: string | string[]
    screenerSignal?: string | string[]
    modelName?: string | string[]
  }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const ticker = resolvedParams.ticker.toUpperCase()
  const requestHeaders = await headers()
  const requestLogContext: BackendRequestLogContext = {
    ticker,
    requestId: crypto.randomUUID(),
    navigationMode: detectNavigationMode(requestHeaders),
  }
  logStockPageEvent('info', 'render start', requestLogContext)

  const currency = currencyForTicker(ticker)
  const sourceContext = singleSearchParam(resolvedSearchParams.from)
  const screenerSignal = sanitizeScreenerSignal(singleSearchParam(resolvedSearchParams.screenerSignal))
  const modelName = sanitizeModelName(singleSearchParam(resolvedSearchParams.modelName))
  const stockEntrySource = stockEntrySourceFromContext(sourceContext)
  const modelTag = sourceContext === 'model' && modelName ? `From Model: ${modelName}` : null
  const screenerTag =
    sourceContext === 'screener' && screenerSignal ? `From Signals: ${screenerSignal}` : null

  let tickerSummary: Awaited<ReturnType<typeof getTickerPageSummary>>

  try {
    tickerSummary = await runWithBackendRequestLogContext(requestLogContext, () => getTickerPageSummary(ticker))
  } catch (error) {
    const details = backendErrorDetails(error)
    logStockPageEvent('error', 'required summary unavailable', requestLogContext, {
      endpoint: `/tickers/${ticker}/summary`,
      error: details.message,
      aborted: details.aborted,
      timeout: details.timeout,
    })
    return (
      <div className="space-y-4">
        <EmptyState
          title="Ticker data is temporarily unavailable"
          description="The frontend could not load the canonical summary from finance-backend for this ticker."
          action={<RetryButton>Retry</RetryButton>}
        />
      </div>
    )
  }

  const scorecard = scorecardFromTickerSummary(tickerSummary)
  const [ohlcResult, recentSignals, latestScreenerRows, fundamentals] = await runWithBackendRequestLogContext(
    requestLogContext,
    () =>
      Promise.all([
        loadStockOhlcDataset(requestLogContext, tickerSummary.coverage),
        loadOptionalStockDataset(
          requestLogContext,
          `/signals/history/${ticker}`,
          [],
          () => getCachedSignalHistoryForTicker(ticker, 180)
        ),
        loadOptionalStockDataset(
          requestLogContext,
          `/screener/signals?tickers=${ticker}`,
          [],
          () => getCachedLatestScreenerRow(ticker)
        ),
        loadOptionalStockDataset<TickerFundamentals | null>(
          requestLogContext,
          `/tickers/${ticker}/profile`,
          null,
          () => getTickerFundamentals(ticker)
        ),
      ])
  )

  const ohlcData = ohlcResult.rows
  logStockPageEvent('info', 'render data ready', requestLogContext, {
    hasOhlc: ohlcData.length > 0,
    ohlcStatus: ohlcResult.status,
    ohlcReason: ohlcResult.reason,
    ohlcCacheKey: ohlcResult.cacheKey,
    signalRows: recentSignals.length,
    screenerRows: latestScreenerRows.length,
    scorecardReadiness: scorecard.readiness,
  })
  const historicalData = ohlcData.map((point) => ({ date: point.date, close: point.close }))
  const historicalChartState =
    ohlcResult.status === 'loaded'
      ? 'loaded'
      : ohlcResult.status === 'empty'
        ? 'empty'
        : 'error'

  const relationship252Promise = runWithBackendRequestLogContext(requestLogContext, () =>
    getTickerRelationships(ticker, { window: 252, topK: 50 }).catch((error) => {
      const details = backendErrorDetails(error)
      logStockPageEvent('error', 'relationship dataset unavailable', requestLogContext, {
        endpoint: `/relationships/${ticker}?window=252`,
        error: details.message,
        aborted: details.aborted,
        timeout: details.timeout,
      })
      return emptyRelationships(ticker, 252)
    })
  )

  const relationships252 = await relationship252Promise
  const relatedAssetsPromise = runWithBackendRequestLogContext(requestLogContext, () => {
      const relationships = relationships252
      const candidates = rankTickerRelationshipCandidates(relationships, ticker)
      return Promise.all(candidates.map((item) => getStockQuote(item.symbol).catch(() => null).then((quote) => ({
        symbol: item.symbol,
        name: quote?.name ?? null,
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
        relation: item.relations.join(' · '),
        strength: item.strength,
        confidence: item.confidence,
      }))))
    })
    .catch((error) => {
      const details = backendErrorDetails(error)
      logStockPageEvent('error', 'related assets unavailable', requestLogContext, {
        endpoint: `/stocks/${ticker}/related-assets`,
        error: details.message,
        aborted: details.aborted,
        timeout: details.timeout,
      })
      return []
    })

  const marketQuote = tickerSummary.quote
  const marketStats = tickerSummary.marketStats
  const fundamentalsSummary = tickerSummary.fundamentalsSummary
  const latestFundamentals = tickerSummary.latestFundamentals
  const quote = tickerSummary.quote
  const displayName = marketQuote?.name ?? quote?.name ?? ticker
  const isEtf = stockAssetKind({
    ticker,
    name: displayName,
    latestFundamentals,
  }) === 'fund'

  const latestHistorySignal = recentSignals[0] ?? null
  const latestScreenerSignal = latestScreenerRows[0] ?? null
  const latestSignal =
    latestScreenerSignal && latestScreenerSignal.signalDate
      ? {
          direction: latestScreenerSignal.direction,
          conviction: latestScreenerSignal.conviction,
          horizon: latestScreenerSignal.predictionHorizon ?? 20,
          signalDate: latestScreenerSignal.signalDate,
        }
      : latestHistorySignal
        ? {
            direction: latestHistorySignal.direction,
            conviction: latestHistorySignal.prob_side,
            horizon: latestHistorySignal.prediction_horizon,
            signalDate: latestHistorySignal.signal_date,
          }
        : null

  const canonicalStats = canonicalTickerStats({
    snapshotProfileMarketCap: tickerSummary.profile?.marketCap,
    fundamentalsMarketCap: fundamentalsSummary?.marketCap,
    quoteMarketCapText: marketQuote?.marketCapText,
    fundamentalsTrailingPe: fundamentalsSummary?.trailingPe,
    profileTrailingPe: tickerSummary.profile?.trailingPe,
    marketStatsVolume: marketStats?.volume,
  })
  const marketCapNumeric = canonicalStats.marketCap ?? parseCompactCurrencyNumber(canonicalStats.marketCapText)
  const marketCapValue =
    marketCapNumeric !== null
      ? formatCompactMoney(marketCapNumeric, currency)
      : canonicalStats.marketCapText ?? '—'
  const trailingPe = canonicalStats.trailingPe !== null ? canonicalStats.trailingPe.toFixed(2) : '—'
  const dividendYieldRow = latestFundamentals.find((item) =>
    `${item.metric.toLowerCase()} ${item.metricLabel.toLowerCase()}`.includes('yield')
  )
  const dividendYield = (() => {
    if (dividendYieldRow?.valueNumber !== null && dividendYieldRow?.valueNumber !== undefined) {
      const percentage = Math.abs(dividendYieldRow.valueNumber) <= 1
        ? dividendYieldRow.valueNumber * 100
        : dividendYieldRow.valueNumber
      return `${percentage.toFixed(Math.abs(percentage) < 10 ? 2 : 1).replace(/\.0+$/, '')}%`
    }
    return dividendYieldRow?.valueDisplay ?? '—'
  })()
  const volumeValue = canonicalStats.volume !== null ? Math.round(canonicalStats.volume).toLocaleString() : '—'
  const latestRevenueValue =
    fundamentalsSummary?.latestRevenue !== null && fundamentalsSummary?.latestRevenue !== undefined
      ? formatCompactMoney(fundamentalsSummary.latestRevenue, currency)
      : '—'
  const latestEpsValue =
    fundamentalsSummary?.latestEps !== null && fundamentalsSummary?.latestEps !== undefined
      ? fundamentalsSummary.latestEps.toFixed(2)
      : '—'

  const keyStats = [
    { label: 'Market Cap', value: marketCapValue },
    { label: 'P/E', value: trailingPe },
    { label: 'Revenue', value: latestRevenueValue },
    { label: 'EPS', value: latestEpsValue },
    { label: 'Dividend Yield', value: dividendYield },
    { label: 'Volume', value: volumeValue },
    { label: '52W High', value: formatMoney(marketStats?.week52High ?? null, currency) },
    { label: '52W Low', value: formatMoney(marketStats?.week52Low ?? null, currency) },
  ].filter((stat) => stat.value !== '—').slice(0, 6)
  const fundamentalGroups = buildFundamentalGroups(latestFundamentals, fundamentals, currency)
  const holdings = isEtf ? fundamentals?.holdings ?? [] : []

  return (
    <div className="space-y-4 md:space-y-5">
      <TrackEventOnMount
        eventName="view_stock"
        payload={{
          ticker,
          entry_source: stockEntrySource,
          has_screener_context: Boolean(screenerTag),
          has_model_context: Boolean(modelTag),
        }}
      />

      {modelTag || screenerTag ? (
        <div className="flex flex-wrap items-center gap-2">
          {modelTag ? <Badge variant="neutral">{modelTag}</Badge> : null}
          {screenerTag ? <Badge variant="neutral">{screenerTag}</Badge> : null}
        </div>
      ) : null}

      <StockOverviewClient
        ticker={ticker}
        currency={currency}
        assetBadgeLabel={isEtf ? 'ETF' : 'Equity'}
        latestSignal={latestSignal}
        historicalData={historicalData}
        historicalChartState={historicalChartState}
        ohlcData={ohlcData}
        keyStats={keyStats}
        fundamentalGroups={fundamentalGroups}
        holdings={holdings}
        sectorWeights={fundamentals?.sectorWeights ?? []}
        nextEarnings={tickerSummary.nextEarnings ? {
          date: tickerSummary.nextEarnings.earningsDate,
          time: tickerSummary.nextEarnings.earningsTime,
          fiscalPeriod: tickerSummary.nextEarnings.fiscalPeriod,
        } : null}
        volatility30d={marketStats?.vol30dPct ?? null}
        relatedAssets={relatedAssetsPromise}
        regimeSignals={recentSignals.map((signal) => ({
          signal_date: signal.signal_date,
          direction: signal.direction,
          prob_side: signal.prob_side,
          prediction_horizon: signal.prediction_horizon,
          episode_return: signal.live_episode_return_to_date ?? signal.realized_return,
          episode_status: signal.live_episode_status,
        }))}
        scorecard={scorecard}
      />
    </div>
  )
}
