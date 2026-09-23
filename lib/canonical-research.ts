import 'server-only'

import { fetchBackendJson } from '@/lib/backend'

export type CanonicalAvailability = {
  available: boolean
  reason: string | null
  symbol: string
  count: number
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
  } = {},
): Promise<FinancialStatementsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<FinancialStatementsPayload>(
    `/tickers/${encodeURIComponent(ticker)}/financial-statements${queryString({
      statementType: options.statementType,
      periodType: options.periodType,
      limit: options.limit ?? 500,
    })}`,
    { context: `ticker.financial-statements.${ticker}` },
  )
}

export async function getTickerMarketMetrics(
  tickerRaw: string,
  options: { metric?: string; latestOnly?: boolean; limit?: number } = {},
): Promise<MarketMetricsPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<MarketMetricsPayload>(
    `/tickers/${encodeURIComponent(ticker)}/market-metrics${queryString({
      metric: options.metric,
      latestOnly: options.latestOnly ?? false,
      limit: options.limit ?? 250,
    })}`,
    { context: `ticker.market-metrics.${ticker}` },
  )
}

export async function getTickerEvents(
  tickerRaw: string,
  options: { startDate?: string; endDate?: string; latestOnly?: boolean; limit?: number } = {},
): Promise<EventCalendarPayload> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<EventCalendarPayload>(
    `/tickers/${encodeURIComponent(ticker)}/events${queryString({
      startDate: options.startDate,
      endDate: options.endDate,
      latestOnly: options.latestOnly ?? true,
      limit: options.limit ?? 200,
    })}`,
    { context: `ticker.events.${ticker}` },
  )
}

export async function getTickerDisclosures(
  tickerRaw: string,
  options: { latestOnly?: boolean; limit?: number } = {},
): Promise<DisclosurePayload> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<DisclosurePayload>(
    `/tickers/${encodeURIComponent(ticker)}/disclosures${queryString({
      latestOnly: options.latestOnly ?? true,
      limit: options.limit ?? 100,
    })}`,
    { context: `ticker.disclosures.${ticker}` },
  )
}

/**
 * Raw `/tickers/{ticker}/readings` payload. Validation happens in
 * `lib/ticker-readings.ts`; callers must only request this for a signed-in reader.
 */
export async function getTickerReadingsPayload(tickerRaw: string): Promise<unknown> {
  const ticker = normalizedTicker(tickerRaw)
  return fetchBackendJson<unknown>(`/tickers/${encodeURIComponent(ticker)}/readings`, {
    context: `ticker.readings.${ticker}`,
  })
}
