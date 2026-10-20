import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'
import StockOverviewClient from '@/components/stocks/StockOverviewClient'
import DisplayCurrencyNote from '@/components/stocks/DisplayCurrencyNote'
import {
  backendErrorDetails,
  runWithBackendRequestLogContext,
  type BackendRequestLogContext,
} from '@/lib/backend-request-log'
import { BackendDataError } from '@/lib/backend'
import { getTickerDisclosures, getTickerEvents, getTickerFinancialStatements } from '@/lib/canonical-research'
import { annualSeries, summaryAmount, summaryDate, summaryPercent, type ReportedPoint } from '@/lib/statement-reading'
import { currencyForTicker, formatCompactMoney } from '@/lib/currency'
import { amountOf, amountView, mergeReports, moneyEntryOf, unconvertedReasonText } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import {
  getOhlcData,
  getStockQuote,
  getTickerFundamentals,
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
import {
  getTickerPageSummary,
  type SymbolCoverageRow,
} from '@/lib/ticker-data'
import { scorecardFromTickerSummary } from '@/lib/ticker-page-scorecard'
import { canonicalTickerStats, parseCompactCurrencyNumber } from '@/lib/ticker-page-stats'
import { buildEventMarkers, type EventMarker } from '@/lib/event-markers'
import { resolveStockAsset } from '@/lib/stock-asset-kind'

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


function overviewFigure(value: number | null, asOf: string | null): { value: number; asOf: string | null } | null {
  return value === null ? null : { value, asOf }
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
  coverage: SymbolCoverageRow,
  displayCurrency: string | null,
): Promise<OhlcLoadResult> {
  const expectsPrices = coverageExpectsPrices(coverage)

  try {
    return await getOhlcData(context.ticker, 3650, expectsPrices, displayCurrency)
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
    title: `${ticker} Markets Signal, Research & Overview - Vesconte`,
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
    currency?: string | string[]
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

  // `?currency=`: every amount below comes converted by the backend; nothing is converted here.
  const requestedCurrency = await resolveDisplayCurrency(resolvedSearchParams.currency)
  const sourceContext = singleSearchParam(resolvedSearchParams.from)
  const screenerSignal = sanitizeScreenerSignal(singleSearchParam(resolvedSearchParams.screenerSignal))
  const modelName = sanitizeModelName(singleSearchParam(resolvedSearchParams.modelName))
  const stockEntrySource = stockEntrySourceFromContext(sourceContext)
  const modelTag = sourceContext === 'model' && modelName ? `From Model: ${modelName}` : null
  const screenerTag =
    sourceContext === 'screener' && screenerSignal ? `From Signals: ${screenerSignal}` : null

  let tickerSummary: Awaited<ReturnType<typeof getTickerPageSummary>>

  try {
    tickerSummary = await runWithBackendRequestLogContext(requestLogContext, () => getTickerPageSummary(ticker, requestedCurrency))
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
          description="The summary for this ticker could not be loaded right now."
          action={<RetryButton>Retry</RetryButton>}
        />
      </div>
    )
  }

  // A currency the backend refused falls back to amounts as reported.
  const displayCurrency = tickerSummary.displayReport && !tickerSummary.displayReport.unsupported ? requestedCurrency : null
  const currency = displayCurrency ?? currencyForTicker(ticker)
  const reportedCurrency = tickerSummary.asset?.currency ?? currencyForTicker(ticker)
  const scorecard = scorecardFromTickerSummary(tickerSummary)
  // Reported annual revenue for the Fundamentals card: the same series the
  // Fundamentals tab draws (Spec PRD-78, "Os mesmos números em todas as tabs").
  // Not awaited; the card waits for it on its own.
  const revenuePromise = runWithBackendRequestLogContext(requestLogContext, () =>
    loadOptionalStockDataset<ReportedPoint[] | null>(requestLogContext, `/tickers/${ticker}/financial-statements`, null, async () => {
      const income = await getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500, currency: displayCurrency })
      return income.available ? annualSeries(income.rows, 'revenue') : null
    })
  )
  // Company events for the expanded chart's Events layer. Not awaited: the page
  // renders without them and the chart reads them when it opens. `null` means
  // they could not be loaded; an empty list means none are recorded.
  const chartEventsPromise = runWithBackendRequestLogContext(requestLogContext, () =>
    loadOptionalStockDataset<EventMarker[] | null>(requestLogContext, `/tickers/${ticker}/events`, null, async () => {
      const today = new Date().toISOString().slice(0, 10)
      const start = new Date(Date.now() - 3650 * 86_400_000).toISOString().slice(0, 10)
      const [payload, disclosures] = await Promise.all([
        getTickerEvents(ticker, { startDate: start, endDate: today, latestOnly: true, limit: 200 }),
        // Guidance lives in the disclosures stream; the layer still shows the
        // company's events when it cannot be read.
        getTickerDisclosures(ticker, { latestOnly: true, limit: 100 }).catch(() => null),
      ])
      if (!payload.available || !Array.isArray(payload.rows)) return []
      const guidance = disclosures?.available && Array.isArray(disclosures.rows)
        ? disclosures.rows.filter((row) => row.domain === 'guidance' && (row.occursAt ?? '') >= start)
        : []
      return buildEventMarkers([...payload.rows, ...guidance], today)
    })
  )
  const [ohlcResult, fundamentals] = await runWithBackendRequestLogContext(
    requestLogContext,
    () =>
      Promise.all([
        loadStockOhlcDataset(requestLogContext, tickerSummary.coverage, displayCurrency),
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
  // Spec "Instrument type as the single source V1": the registry decides; the old
  // name-and-list guess applies only when the registry type is unknown.
  const resolvedAsset = resolveStockAsset({
    assetType: tickerSummary.asset?.assetType,
    ticker,
    name: displayName,
    latestFundamentals,
  })
  const isEtf = resolvedAsset.kind === 'fund'

  const canonicalStats = canonicalTickerStats({
    snapshotProfileMarketCap: tickerSummary.profile?.marketCap,
    fundamentalsMarketCap: fundamentalsSummary?.marketCap,
    // Preformatted text in the listing's currency; never shown as a converted amount.
    quoteMarketCapText: displayCurrency ? null : marketQuote?.marketCapText,
    fundamentalsTrailingPe: fundamentalsSummary?.trailingPe,
    profileTrailingPe: tickerSummary.profile?.trailingPe,
    marketStatsVolume: marketStats?.volume,
  })
  const marketCapNumeric = canonicalStats.marketCap ?? parseCompactCurrencyNumber(canonicalStats.marketCapText)
  // Under the chart: market cap and next earnings only (Spec PRD-78, decision 7).
  const marketCapValue = marketCapNumeric !== null
    ? formatCompactMoney(marketCapNumeric, currency)
    : canonicalStats.marketCapText ?? null
  const holdings = isEtf ? fundamentals?.holdings ?? [] : []
  const displayContext = { display: displayCurrency, original: reportedCurrency }
  // The market cap's holder, in the order canonicalTickerStats reads it.
  const marketCapHolder = tickerSummary.profile && (tickerSummary.profile.marketCap !== null || moneyEntryOf(tickerSummary.profile, 'marketCap'))
    ? tickerSummary.profile
    : fundamentalsSummary
  const marketCapText = marketQuote?.marketCapText?.trim() || null
  const marketCapView = displayCurrency
    ? amountView(amountOf(marketCapHolder, 'marketCap', displayContext), formatCompactMoney)
      // Only the quote's preformatted text: shown as reported and marked, never relabelled.
      ?? (marketCapText ? {
        text: marketCapText,
        original: null,
        marker: `not in ${displayCurrency}`,
        detail: unconvertedReasonText('not_offered', displayCurrency),
      } : null)
    : null
  const netCashRow = latestFundamentals.find((row) => /^net\s+cash\b/i.test(row.metricLabel || row.metric.replace(/_/g, ' ')))
  const netCashView = displayCurrency && netCashRow
    ? amountView(amountOf(netCashRow, 'valueNumber', displayContext), formatCompactMoney)
    : null

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

      {displayCurrency ? (
        // The prices drawn here; single figures carry their own marker.
        <DisplayCurrencyNote report={mergeReports(displayCurrency, [ohlcResult.displayReport])} />
      ) : null}

      <StockOverviewClient
        // A new currency starts the client state (the full history it fetched) afresh.
        key={displayCurrency ?? 'reported'}
        displayCurrency={displayCurrency}
        marketCapView={marketCapView}
        netCashView={netCashView}
        ticker={ticker}
        currency={currency}
        isFund={isEtf}
        historicalData={historicalData}
        historicalChartState={historicalChartState}
        ohlcData={ohlcData}
        marketCap={marketCapValue}
        holdings={holdings}
        sectorWeights={fundamentals?.sectorWeights ?? []}
        nextEarnings={tickerSummary.nextEarnings ? {
          date: tickerSummary.nextEarnings.earningsDate,
          time: tickerSummary.nextEarnings.earningsTime,
          fiscalPeriod: tickerSummary.nextEarnings.fiscalPeriod,
        } : null}
        relatedAssets={relatedAssetsPromise}
        chartEvents={chartEventsPromise}
        scorecard={scorecard}
        revenue={revenuePromise}
        operatingMargin={overviewFigure(summaryPercent(latestFundamentals, /operating\s+margin/i), summaryDate(latestFundamentals, /operating\s+margin/i))}
        netCash={overviewFigure(summaryAmount(latestFundamentals, /^net\s+cash\b/i), summaryDate(latestFundamentals, /^net\s+cash\b/i))}
      />
    </div>
  )
}
