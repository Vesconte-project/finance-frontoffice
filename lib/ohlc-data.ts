export const STOCK_OHLC_CACHE_KEY = 'stock-ohlc-cache-v2'

export type OhlcPoint = {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number
  volume: number | null
}

export type OhlcResultStatus =
  | 'loaded'
  | 'empty'
  | 'backend_failure'
  | 'malformed'
  | 'inconsistent_coverage'

export type OhlcLoadResult = {
  status: OhlcResultStatus
  rows: OhlcPoint[]
  reason: string
  cacheKey: typeof STOCK_OHLC_CACHE_KEY
  backendStatus: number | null
  rawRows: number | null
  validRows: number
}

export class OhlcPayloadError extends Error {
  readonly result: OhlcLoadResult

  constructor(result: OhlcLoadResult) {
    super(result.reason)
    this.name = 'OhlcPayloadError'
    this.result = result
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeOhlcRow(value: unknown): OhlcPoint | null {
  if (!value || typeof value !== 'object') return null
  const row = value as {
    date?: unknown
    open?: unknown
    high?: unknown
    low?: unknown
    close?: unknown
    volume?: unknown
  }
  const date = typeof row.date === 'string' && row.date.trim() ? row.date : null
  const close = numberOrNull(row.close)
  if (!date || close === null) return null
  return {
    date,
    open: numberOrNull(row.open),
    high: numberOrNull(row.high),
    low: numberOrNull(row.low),
    close: Number(close.toFixed(4)),
    volume: numberOrNull(row.volume),
  }
}

export function normalizeOhlcPayload(
  payload: unknown,
  options: {
    coverageExpectsPrices: boolean
    backendStatus?: number | null
  }
): OhlcLoadResult {
  const backendStatus = options.backendStatus ?? 200

  if (!Array.isArray(payload)) {
    throw new OhlcPayloadError({
      status: 'malformed',
      rows: [],
      reason: 'ohlc_payload_not_array',
      cacheKey: STOCK_OHLC_CACHE_KEY,
      backendStatus,
      rawRows: null,
      validRows: 0,
    })
  }

  const rows = payload
    .map((row) => normalizeOhlcRow(row))
    .filter((row): row is OhlcPoint => row !== null)

  if (rows.length > 0) {
    return {
      status: 'loaded',
      rows,
      reason: 'ohlc_rows_loaded',
      cacheKey: STOCK_OHLC_CACHE_KEY,
      backendStatus,
      rawRows: payload.length,
      validRows: rows.length,
    }
  }

  if (payload.length > 0) {
    throw new OhlcPayloadError({
      status: 'malformed',
      rows: [],
      reason: 'ohlc_payload_has_no_valid_rows',
      cacheKey: STOCK_OHLC_CACHE_KEY,
      backendStatus,
      rawRows: payload.length,
      validRows: 0,
    })
  }

  if (options.coverageExpectsPrices) {
    throw new OhlcPayloadError({
      status: 'inconsistent_coverage',
      rows: [],
      reason: 'ohlc_empty_but_coverage_has_prices',
      cacheKey: STOCK_OHLC_CACHE_KEY,
      backendStatus,
      rawRows: 0,
      validRows: 0,
    })
  }

  return {
    status: 'empty',
    rows: [],
    reason: 'ohlc_empty_without_price_coverage',
    cacheKey: STOCK_OHLC_CACHE_KEY,
    backendStatus,
    rawRows: 0,
    validRows: 0,
  }
}

export function ohlcBackendFailureResult(input: {
  reason: string
  backendStatus?: number | null
}): OhlcLoadResult {
  return {
    status: 'backend_failure',
    rows: [],
    reason: input.reason,
    cacheKey: STOCK_OHLC_CACHE_KEY,
    backendStatus: input.backendStatus ?? null,
    rawRows: null,
    validRows: 0,
  }
}

export function ohlcMalformedResult(input: {
  reason: string
  backendStatus?: number | null
}): OhlcLoadResult {
  return {
    status: 'malformed',
    rows: [],
    reason: input.reason,
    cacheKey: STOCK_OHLC_CACHE_KEY,
    backendStatus: input.backendStatus ?? null,
    rawRows: null,
    validRows: 0,
  }
}
