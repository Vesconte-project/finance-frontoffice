import 'server-only'

import { fetchBackendJson } from '@/lib/backend'
import type { DisplayCurrencyReport } from '@/lib/display-currency'
import { fetchInDisplayCurrency } from '@/lib/display-currency-server'

export type CanonicalAvailability = {
  available: boolean
  reason: string | null
  symbol: string
  count: number
  /** Set when the read was made in a display currency (see lib/display-currency.ts). */
  displayReport?: DisplayCurrencyReport | null
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

/** A ticker read in `currency` when one is chosen, its report attached. */
async function readInCurrency<T extends CanonicalAvailability>(path: string, currency: string | null | undefined, context: string): Promise<T> {
  const { payload, report } = await fetchInDisplayCurrency(path, currency ?? null, (target) => fetchBackendJson<T>(target, { context }))
  return report && payload && typeof payload === 'object' ? { ...payload, displayReport: report } : payload
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
    currency?: string | null
    statementType?: FinancialStatementType
    periodType?: FinancialStatementPeriod
    limit?: number
  } = {},
): Promise<FinancialStatementsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return readInCurrency<FinancialStatementsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/financial-statements${queryString({
      statementType: options.statementType,
      periodType: options.periodType,
      limit: options.limit ?? 500,
    })}`,
    options.currency,
    `ticker.financial-statements.${ticker}`,
  )
}

export async function getTickerMarketMetrics(
  tickerRaw: string,
  options: { currency?: string | null; metric?: string; latestOnly?: boolean; limit?: number } = {},
): Promise<MarketMetricsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return readInCurrency<MarketMetricsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/market-metrics${queryString({
      metric: options.metric,
      latestOnly: options.latestOnly ?? false,
      limit: options.limit ?? 250,
    })}`,
    options.currency,
    `ticker.market-metrics.${ticker}`,
  )
}

export async function getTickerCorporateActions(
  tickerRaw: string,
  options: { currency?: string | null; actionType?: 'dividend' | 'split'; limit?: number } = {},
): Promise<CorporateActionsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return readInCurrency<CorporateActionsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/corporate-actions${queryString({
      actionType: options.actionType,
      latestOnly: true,
      limit: options.limit ?? 200,
    })}`,
    options.currency,
    `ticker.corporate-actions.${ticker}`,
  )
}

export async function getTickerEquityCapitalEvents(
  tickerRaw: string,
  options: { currency?: string | null; limit?: number } = {},
): Promise<EquityCapitalEventsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return readInCurrency<EquityCapitalEventsPayload>(
    `/v1/tickers/${encodeURIComponent(ticker)}/equity-capital-events${queryString({
      latestOnly: true,
      limit: options.limit ?? 500,
    })}`,
    options.currency,
    `ticker.equity-capital-events.${ticker}`,
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
