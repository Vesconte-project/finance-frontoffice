import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'
import { marketLimitWait } from '@/lib/market-limit'
import { loadStockSummaryState } from '@/lib/stock-summary-state'
import RetryButton from '@/components/ui/RetryButton'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'
import StockOverviewClient from '@/components/stocks/StockOverviewClient'
import {
  backendErrorDetails,
  runWithBackendRequestLogContext,
  type BackendRequestLogContext,
} from '@/lib/backend-request-log'
import { BackendDataError } from '@/lib/backend'
import { getTickerFinancialStatements } from '@/lib/canonical-research'
import { annualSeries, summaryAmount, summaryCurrency, summaryDate, summaryPercent, type ReportedPoint } from '@/lib/statement-reading'
import { currencyForTicker, formatCompactMoney } from '@/lib/currency'
import { convertedAmountOf, isoCurrency, localizeSummary } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import {
  getConvertedOhlc,
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
  STOCK_DAILY_OHLC_CACHE_KEY,
  type OhlcLoadResult,
} from '@/lib/ohlc-data'
import { getAtlasCompany } from '@/lib/atlas'
import {
  getTickerPageSummary,
  type SymbolCoverageRow,
} from '@/lib/ticker-data'
import { scorecardFromTickerSummary } from '@/lib/ticker-page-scorecard'
import { canonicalTickerStats, parseCompactCurrencyNumber } from '@/lib/ticker-page-stats'
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


function overviewFigure(value: number | null, asOf: string | null, currency?: string | null): { value: number; asOf: string | null; currency?: string | null } | null {
  return value === null ? null : { value, asOf, currency }
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
  periodDays = 0,
  requestCurrency?: string
): Promise<OhlcLoadResult> {
  const expectsPrices = coverageExpectsPrices(coverage)

  try {
    return await getOhlcData(context.ticker, periodDays, expectsPrices, requestCurrency)
  } catch (error) {
    const details = backendErrorDetails(error)
    const unavailable =
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

    const result: OhlcLoadResult = {
      ...unavailable,
      cacheKey: periodDays === 365 ? STOCK_DAILY_OHLC_CACHE_KEY : STOCK_OHLC_CACHE_KEY,
      resolution: null,
    }
    const logLevel = expectsPrices ? 'warn' : 'error'
    logStockPageEvent(logLevel, 'ohlc dataset unavailable', context, {
      endpoint: `/tickers/${context.ticker}/ohlc?period_days=${periodDays}`,
      coverageHasPrices: coverage.hasPrices,
      coveragePriceRows: coverage.priceRows,
      coverageFirstPriceDate: coverage.firstPriceDate,
      coverageLastPriceDate: coverage.lastPriceDate,
      ohlcStatus: result.status,
      ohlcReason: result.reason,
      ohlcRawRows: result.rawRows,
      ohlcValidRows: result.validRows,
      cacheKey: result.cacheKey,
      expectedCacheKey: result.cacheKey,
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

/** Only consulted after a 429, to offer what helps this viewer; any failure reads as signed out. */
async function viewerIsSignedIn(): Promise<boolean> {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return false
  const { auth } = await import('@clerk/nextjs/server')
  return Boolean((await auth()).userId)
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

  const sourceContext = singleSearchParam(resolvedSearchParams.from)
  const screenerSignal = sanitizeScreenerSignal(singleSearchParam(resolvedSearchParams.screenerSignal))
  const modelName = sanitizeModelName(singleSearchParam(resolvedSearchParams.modelName))
  const stockEntrySource = stockEntrySourceFromContext(sourceContext)
  const modelTag = sourceContext === 'model' && modelName ? `From Model: ${modelName}` : null
  const screenerTag =
    sourceContext === 'screener' && screenerSignal ? `From Signals: ${screenerSignal}` : null

  const summaryState = await loadStockSummaryState(
    () => runWithBackendRequestLogContext(requestLogContext, () => getTickerPageSummary(ticker)),
    viewerIsSignedIn,
  )

  if (summaryState.status !== 'ok') {
    const error = summaryState.status === 'error' ? summaryState.error : null
    const details = backendErrorDetails(error)
    logStockPageEvent('error', 'required summary unavailable', requestLogContext, {
      endpoint: `/tickers/${ticker}/summary`,
      error: summaryState.status === 'limit' ? 'market limit reached (429)' : details.message,
      aborted: details.aborted,
      timeout: details.timeout,
    })
    if (summaryState.status === 'limit') {
      // A reached limit, not a fault: no retry button, which would only spend the wait.
      const wait = marketLimitWait(summaryState.notice)
      return (
        <div className="space-y-4">
          {summaryState.signedIn ? (
            <EmptyState
              title="You have reached your plan's limit for company pages"
              description={`You can open more company pages ${wait}.`}
              action={
                <Link prefetch={false} href="/pricing" className={buttonClass({ variant: 'secondary' })}
                  data-analytics-id="market_limit_plans">
                  See plans
                </Link>
              }
              analyticsId="market_limit_reached_signed_in"
            />
          ) : (
            <EmptyState
              title="You have reached the limit for browsing without an account"
              description={`Create a free account to keep reading, or come back ${wait}.`}
              action={
                <Link prefetch={false} href={`/sign-up?redirect_url=${encodeURIComponent(`/stocks/${ticker}`)}`}
                  className={buttonClass({ variant: 'primary' })} data-analytics-id="market_limit_sign_up">
                  Create a free account
                </Link>
              }
              analyticsId="market_limit_reached"
            />
          )}
        </div>
      )
    }
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
  const tickerSummary = summaryState.summary

  // The listing's currency, as the header shows it.
  const currency = tickerSummary.asset?.currency ?? tickerSummary.fundamentalsSummary?.currency ?? currencyForTicker(ticker)
  // `?currency=`: the page's amounts in that currency, converted by the backend
  // at each value's own date; a code the backend does not list, or the listing's
  // own currency, is no display currency.
  const requestedCurrency = await resolveDisplayCurrency(resolvedSearchParams.currency).catch(() => null)
  const displayCurrency = requestedCurrency && requestedCurrency !== isoCurrency(currency) ? requestedCurrency : null
  const scorecard = scorecardFromTickerSummary(tickerSummary)
  // Reported annual revenue for the Fundamentals card: the same series the
  // Fundamentals tab draws (Spec PRD-78, "Os mesmos números em todas as tabs").
  // Not awaited; the card waits for it on its own.
  // The atlas panel depends on nothing above: start it now, not after the prices (ENG-272).
  const atlasCompanyPromise = runWithBackendRequestLogContext(requestLogContext, () => getAtlasCompany(ticker))
    .catch(() => ({ status: 'unavailable' as const }))
  // The complete history walks its pages one after another (~2.8 s measured on 08/11). The page
  // renders with the last year and streams the complete history to the chart when it arrives.
  const fullOhlcPromise: Promise<OhlcLoadResult> = runWithBackendRequestLogContext(requestLogContext,
    () => loadStockOhlcDataset(requestLogContext, tickerSummary.coverage))
    .catch((error: unknown) => ohlcBackendFailureResult({
      reason: error instanceof Error ? error.message : 'complete history unavailable', backendStatus: null }))
  const revenuePromise = runWithBackendRequestLogContext(requestLogContext, () =>
    loadOptionalStockDataset<ReportedPoint[] | null>(requestLogContext, `/tickers/${ticker}/financial-statements`, null, async () => {
      const income = await getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500, displayCurrency })
      return income.available ? annualSeries(income.rows, 'revenue') : null
    })
  )
  const [dailyOhlcResult, fundamentals] = await runWithBackendRequestLogContext(
    requestLogContext,
    () =>
      Promise.all([
        loadStockOhlcDataset(requestLogContext, tickerSummary.coverage, 365, displayCurrency ?? undefined),
        loadOptionalStockDataset<TickerFundamentals | null>(
          requestLogContext,
          `/tickers/${ticker}/profile`,
          null,
          () => getTickerFundamentals(ticker)
        ),
      ])
  )

  logStockPageEvent('info', 'render data ready', requestLogContext, {
    hasOhlc: dailyOhlcResult.rows.length > 0,
    ohlcStatus: dailyOhlcResult.status,
    ohlcReason: dailyOhlcResult.reason,
    ohlcCacheKey: dailyOhlcResult.cacheKey,
    scorecardReadiness: scorecard.readiness,
  })
  // The first paint's chart state comes from the last year; the client upgrades it with the
  // complete history when that arrives.
  const historicalChartState =
    dailyOhlcResult.status === 'loaded'
      ? 'loaded'
      : dailyOhlcResult.status === 'empty'
        ? 'empty'
        : 'error'

  // Related companies are the company's strongest ties on the weekly atlas, with each one's last
  // daily move served in the same panel (ENG-272): no quote per related company, so no company
  // budget spent on names the reader did not open, and no extra stage after the atlas.
  const atlasCompany = await atlasCompanyPromise
  if (atlasCompany.status === 'unavailable') {
    logStockPageEvent('error', 'atlas company panel unavailable', requestLogContext, {
      endpoint: `/v1/atlas/companies/${ticker}`,
      error: 'unavailable',
      aborted: false,
      timeout: false,
    })
  }
  const relationshipsGate = atlasCompany.status === 'denied' && atlasCompany.reason === 'sign_in_required' ? 'signedOut' : null
  const relatedAssetsPromise = runWithBackendRequestLogContext(requestLogContext, () => {
      const neighbours = atlasCompany.status === 'ok' ? atlasCompany.data.neighbours.slice(0, 6).sort((a, b) => Math.abs(b.correlation ?? 0) - Math.abs(a.correlation ?? 0)).slice(0, 5) : []
      return Promise.resolve(neighbours.map((item) => ({
        symbol: item.symbol,
        name: item.name ?? null,
        changePercent: item.changePercent,
        strength: item.correlation,
      })))
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
    quoteMarketCapText: marketQuote?.marketCapText,
    fundamentalsTrailingPe: fundamentalsSummary?.trailingPe,
    profileTrailingPe: tickerSummary.profile?.trailingPe,
    marketStatsVolume: marketStats?.volume,
  })
  const marketCapNumeric = canonicalStats.marketCap ?? parseCompactCurrencyNumber(canonicalStats.marketCapText)
  // Under the chart: market cap and next earnings only (Spec PRD-78, decision 7).
  // In the display currency: the backend's conversion of the same market value it reports
  // (the profile's or the fundamentals', whichever the page shows); without one it stays as reported.
  const convertedSummary = displayCurrency
    ? await runWithBackendRequestLogContext(requestLogContext, () => getTickerPageSummary(ticker, displayCurrency)).catch(() => null)
    : null
  const marketCapSource = canonicalStats.marketCap !== null && canonicalStats.marketCap === tickerSummary.profile?.marketCap
    ? convertedSummary?.profile
    : canonicalStats.marketCap !== null && canonicalStats.marketCap === fundamentalsSummary?.marketCap
      ? convertedSummary?.fundamentalsSummary
      : null
  const marketCapConverted = displayCurrency && marketCapSource ? convertedAmountOf(marketCapSource, 'marketCap', displayCurrency) : null
  // The charts' bars in the display currency (candles and the expanded chart); the technical summary keeps reported bars.
  const [displayBars, dailyDisplayBars] = displayCurrency
    ? await runWithBackendRequestLogContext(requestLogContext, () => Promise.all([
        getConvertedOhlc(ticker, displayCurrency).catch(() => []),
        getConvertedOhlc(ticker, displayCurrency, 365).catch(() => []),
      ]))
    : [null, null]
  // Amounts among the latest fundamentals (net cash) in the display currency when all of them convert.
  const localizedSummary = displayCurrency && convertedSummary ? localizeSummary(convertedSummary, displayCurrency) : null
  const amountRows = localizedSummary?.converted ? localizedSummary.summary.latestFundamentals : latestFundamentals
  const marketCapValue = marketCapConverted
    ? formatCompactMoney(marketCapConverted.value, displayCurrency)
    : marketCapNumeric !== null
      ? formatCompactMoney(marketCapNumeric, currency)
      : canonicalStats.marketCapText ?? null
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
        // A new display currency starts the chart's converted view afresh.
        key={displayCurrency ?? 'listing'}
        displayCurrency={displayCurrency}
        ticker={ticker}
        currency={currency}
        isFund={isEtf}
        historicalChartState={historicalChartState}
        fullOhlc={fullOhlcPromise}
        dailyOhlcData={dailyOhlcResult.rows}
        dailyResolution={dailyOhlcResult.resolution ?? null}
        dailyDisplayBars={dailyDisplayBars}
        displayBars={displayBars}
        marketCap={marketCapValue}
        holdings={holdings}
        sectorWeights={fundamentals?.sectorWeights ?? []}
        nextEarnings={tickerSummary.nextEarnings ? {
          date: tickerSummary.nextEarnings.earningsDate,
          time: tickerSummary.nextEarnings.earningsTime,
          fiscalPeriod: tickerSummary.nextEarnings.fiscalPeriod,
        } : null}
        relatedAssets={relatedAssetsPromise}
        relationshipsGate={relationshipsGate}
        scorecard={scorecard}
        revenue={revenuePromise}
        operatingMargin={overviewFigure(summaryPercent(latestFundamentals, /operating\s+margin/i), summaryDate(latestFundamentals, /operating\s+margin/i))}
        netCash={overviewFigure(summaryAmount(amountRows, /^net\s+cash\b/i), summaryDate(amountRows, /^net\s+cash\b/i), summaryCurrency(amountRows, /^net\s+cash\b/i))}
      />
    </div>
  )
}
