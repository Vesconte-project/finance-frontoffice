import 'server-only'

import { fetchBackendJson } from './backend'
import { localizeRows } from './display-currency'
import { fetchInDisplayCurrency } from './display-currency-server'

export type CanonicalAvailability = {
  available: boolean
  reason: string | null
  symbol: string
  count: number
  /**
   * Set when the read was asked for in a display currency: `converted` when its
   * amounts are now in `code` (every one of them), false when they stay as reported.
   */
  displayCurrency?: { code: string; converted: boolean } | null
}

/**
 * A ticker read in the display currency: asked with `?currency=` and, when every
 * amount has the backend's conversion, returned in it (rows carry the currency).
 * Otherwise, or after a 422, the read as reported. Without a currency, the plain read.
 */
async function readInCurrency<P extends CanonicalAvailability & { rows: unknown[] }>(
  path: string,
  context: string,
  currency: string | null | undefined,
): Promise<P> {
  if (!currency) return fetchBackendJson<P>(path, { context })
  const { payload, refused } = await fetchInDisplayCurrency(path, currency, (url) => fetchBackendJson<P>(url, { context }))
  if (refused || !payload?.available || !Array.isArray(payload.rows)) return { ...payload, displayCurrency: { code: currency, converted: false } }
  const { rows, converted } = localizeRows(payload.rows, currency)
  return { ...payload, rows, displayCurrency: { code: currency, converted } } as P
}

export type FinancialStatementType = 'income_statement' | 'balance_sheet' | 'cash_flow'
export type FinancialStatementPeriod = 'annual' | 'quarterly'

export type FinancialStatementLineItem = {
  symbol: string
  statementType: FinancialStatementType
  lineItemId: string
  displayLabel: string
  value: number | null
  currency: string | null
  periodType: FinancialStatementPeriod
  fiscalYear: number | null
  fiscalQuarter: string | null
  periodEnd: string
  knownAt: string
  source: string | null
  sourceUpdatedAt: string | null
  ingestedAt: string | null
  methodologyVersion: string
  dataQualityFlags: unknown
}

export type FinancialStatementsPayload = CanonicalAvailability & {
  rows: FinancialStatementLineItem[]
}

export type CorporateActionRow = {
  eventId: string | null
  symbol: string | null
  actionType: string | null
  exDate: string | null
  paymentDate: string | null
  /** Sent by the backend; older fixtures leave them out. */
  recordDate?: string | null
  declarationDate?: string | null
  splitRatioText?: string | null
  cashAmount: number | null
  adjustedCashAmount: number | null
  frequency: string | null
  currency: string | null
  knownAt: string | null
  source: string | null
  methodologyVersion: string | null
}

export type CorporateActionsPayload = CanonicalAvailability & {
  rows: CorporateActionRow[]
}

export type EquityCapitalEventRow = {
  eventId: string | null
  eventFamily: string | null
  eventType: string | null
  eventSubtype: string | null
  programName: string | null
  announcementDate: string | null
  filingDate: string | null
  effectiveDate: string | null
  periodStart: string | null
  periodEnd: string | null
  amountExecuted: number | null
  shareCountExecuted: number | null
  averagePrice: number | null
  currency: string | null
  knownAt: string | null
  source: string | null
}

export type EquityCapitalEventsPayload = CanonicalAvailability & {
  rows: EquityCapitalEventRow[]
}

export type MarketMetricObservation = {
  symbol: string
  metric: string
  value: number | null
  currency: string | null
  observationDate: string
  knownAt: string
  source: string | null
  sourceUpdatedAt: string | null
  ingestedAt: string | null
  methodologyVersion: string
  dataQualityFlags: unknown
}

export type MarketMetricsPayload = CanonicalAvailability & {
  rows: MarketMetricObservation[]
}

export type CanonicalEvent = {
  domain: string
  eventId: string | null
  symbol: string | null
  eventType: string
  title: string
  classification: string
  occursAt: string | null
  occursAtRole: string
  knownAt: string | null
  source: string | null
  primarySource: string | null
  sourceMetadata: unknown
  dataQualityFlags: unknown
  confidence: string | null
  documentType?: string | null
  documentUrl?: string | null
  quote?: string | null
}

export type EventCalendarPayload = CanonicalAvailability & {
  snapshotMode: string
  isPointInTime: boolean
  startDate: string | null
  endDate: string | null
  unavailableDomains: string[]
  rows: CanonicalEvent[]
}

export type DisclosurePayload = CanonicalAvailability & {
  snapshotMode: string
  isPointInTime: boolean
  unavailableDomains: string[]
  rows: CanonicalEvent[]
}

function normalizedTicker(value: string): string {
  return value.trim().toUpperCase()
}

function queryString(values: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function getTickerFinancialStatements(
  tickerRaw: string,
  options: {
    statementType?: FinancialStatementType
    periodType?: FinancialStatementPeriod
    limit?: number
    /** Amounts in this currency when the backend converts every one (`readInCurrency`). */
    displayCurrency?: string | null
  } = {},
): Promise<FinancialStatementsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return readInCurrency<FinancialStatementsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/financial-statements${queryString({
      statementType: options.statementType,
      periodType: options.periodType,
      limit: options.limit ?? 500,
    })}`,
    `ticker.financial-statements.${ticker}`,
    options.displayCurrency,
  )
}

export async function getTickerMarketMetrics(
  tickerRaw: string,
  options: { metric?: string; latestOnly?: boolean; limit?: number } = {},
): Promise<MarketMetricsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<MarketMetricsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/market-metrics${queryString({
      metric: options.metric,
      latestOnly: options.latestOnly ?? false,
      limit: options.limit ?? 250,
    })}`,
    { context: `ticker.market-metrics.${ticker}` },
  )
}

export async function getTickerCorporateActions(
  tickerRaw: string,
  options: { actionType?: 'dividend' | 'split'; limit?: number; displayCurrency?: string | null } = {},
): Promise<CorporateActionsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return readInCurrency<CorporateActionsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/corporate-actions${queryString({
      actionType: options.actionType,
      latestOnly: true,
      limit: options.limit ?? 200,
    })}`,
    `ticker.corporate-actions.${ticker}`,
    options.displayCurrency,
  )
}

export async function getTickerEquityCapitalEvents(
  tickerRaw: string,
  options: { limit?: number; displayCurrency?: string | null } = {},
): Promise<EquityCapitalEventsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return readInCurrency<EquityCapitalEventsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/equity-capital-events${queryString({
      latestOnly: true,
      limit: options.limit ?? 500,
    })}`,
    `ticker.equity-capital-events.${ticker}`,
    options.displayCurrency,
  )
}

// Public read models only: share repeated reads for one minute. Viewer-scoped
// research and mutations retain the no-store default in lib/backend.ts.
export async function getTickerEvents(
  tickerRaw: string,
  options: { startDate?: string; endDate?: string; latestOnly?: boolean; limit?: number } = {},
): Promise<EventCalendarPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<EventCalendarPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/events${queryString({
      startDate: options.startDate,
      endDate: options.endDate,
      latestOnly: options.latestOnly ?? true,
      limit: options.limit ?? 200,
    })}`,
    { context: `ticker.events.${ticker}`, init: { cache: 'no-store', next: { revalidate: 60 } } },
  )
}

export async function getTickerDisclosures(
  tickerRaw: string,
  options: { latestOnly?: boolean; limit?: number } = {},
): Promise<DisclosurePayload> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<DisclosurePayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/disclosures${queryString({
      latestOnly: options.latestOnly ?? true,
      limit: options.limit ?? 100,
    })}`,
    { context: `ticker.disclosures.${ticker}`, init: { cache: 'no-store', next: { revalidate: 60 } } },
  )
}

/**
 * Raw `/v1/tickers/{ticker}/readings` payload. Validation happens in
 * `lib/ticker-readings.ts`. Free to every reader: one company's standing, never a list.
 */
export async function getTickerReadingsPayload(tickerRaw: string): Promise<unknown> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<unknown>(`/v1/tickers/${encodeURIComponent(ticker)}/readings`, {
    context: `ticker.readings.${ticker}`,
  })
}
