/**
 * Display currency for the ticker pages. The page always reads in the
 * listing's own currency; a display currency chosen in the URL
 * (`?currency=XXX`, and nowhere else) only adds the backend's conversion in two
 * places: next to the header price, and in the price chart when the reader
 * asks for it. Indicators, signals, scorecards and financial statements stay in
 * the listing's currency.
 *
 * Nothing here converts: the browser and this site never apply a rate. With
 * `?currency=` the backend keeps every original amount and adds a `money`
 * block beside it:
 *
 *   {"close": 75000, "money": {"close": {"value": 75000, "currency": "KRW",
 *     "sourceCurrency": "KRW", "date": "2026-10-13",
 *     "converted": {"value": 54.12, "currency": "USD", "rate": 0.0007216, "rateDate": "2026-10-12"},
 *     "unconvertedReason": null}}}
 *
 * This module parses those blocks defensively, and the `listings` block of the
 * ticker summary (the listings of the same company we track).
 */

export const DISPLAY_CURRENCY_PARAM = 'currency'

/** Reasons the backend gives for an amount it could not convert. */
export const BACKEND_UNCONVERTED_REASONS = ['currency_unknown', 'value_date_unknown', 'no_rate', 'fx_rates_unavailable'] as const
export type BackendUnconvertedReason = (typeof BACKEND_UNCONVERTED_REASONS)[number]

export type MoneyConversion = {
  value: number
  currency: string
  rate: number | null
  rateDate: string | null
}

export type MoneyEntry = {
  price_basis: 'adjusted' | 'raw' | null
  /** The original amount in its ISO currency (a provider minor unit is already scaled into its parent). */
  value: number | null
  currency: string | null
  /** The stored label, case preserved (GBp). */
  sourceCurrency: string | null
  date: string | null
  converted: MoneyConversion | null
  unconvertedReason: BackendUnconvertedReason | null
}

export type CurrencyOption = {
  code: string
  latestRateDate: string | null
  status: string | null
}

export type CurrenciesPayload = {
  available: boolean
  reason: string | null
  pivot: string
  maxStalenessBusinessDays: number | null
  currencies: CurrencyOption[]
}

const CODE = /^[A-Z]{3}$/
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,14}$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** A three-letter upper-case ISO code, or null. Lower case is not accepted: the backend matches exactly. */
export function displayCurrencyCode(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && CODE.test(candidate.trim()) ? candidate.trim() : null
}

/** The ISO parent of a listing label, for comparing with a display currency (GBp → GBP). */
export function isoCurrency(label: string | null | undefined): string | null {
  const raw = text(label)
  if (!raw) return null
  if (raw === 'GBp' || raw.toUpperCase() === 'GBX') return 'GBP'
  if (raw === 'ZAc' || raw.toUpperCase() === 'ZAC') return 'ZAR'
  if (raw.toUpperCase() === 'ILA') return 'ILS'
  const upper = raw.toUpperCase()
  return CODE.test(upper) ? upper : null
}

function parseReason(value: unknown): BackendUnconvertedReason | null {
  return (BACKEND_UNCONVERTED_REASONS as readonly string[]).includes(value as string) ? value as BackendUnconvertedReason : null
}

export function parseMoneyEntry(raw: unknown): MoneyEntry | null {
  const record = asRecord(raw)
  if (!record) return null
  const convertedRecord = asRecord(record.converted)
  const convertedValue = finite(convertedRecord?.value)
  const convertedCurrency = displayCurrencyCode(convertedRecord?.currency)
  const converted = convertedRecord && convertedValue !== null && convertedCurrency
    ? {
        value: convertedValue,
        currency: convertedCurrency,
        rate: finite(convertedRecord.rate),
        rateDate: text(convertedRecord.rateDate),
      }
    : null
  return {
    price_basis: record.price_basis === 'adjusted' || record.price_basis === 'raw' ? record.price_basis : null,
    value: finite(record.value),
    currency: text(record.currency),
    sourceCurrency: text(record.sourceCurrency),
    date: text(record.date),
    converted,
    // A malformed conversion is reported as having no rate, never shown as converted.
    unconvertedReason: converted ? null : parseReason(record.unconvertedReason) ?? 'no_rate',
  }
}

/** The `money` entry of `holder[field]`, or null when the backend did not annotate it. */
export function moneyEntryOf(holder: unknown, field: string): MoneyEntry | null {
  const money = asRecord(asRecord(holder)?.money)
  return money ? parseMoneyEntry(money[field]) : null
}

/** The backend's conversion of `holder[field]` into `target`, or null when there is none. */
export function convertedValueOf(holder: unknown, field: string, target: string): MoneyConversion | null {
  const entry = moneyEntryOf(holder, field)
  const basis = asRecord(holder)?.price_basis
  if ((basis !== 'adjusted' && basis !== 'raw') || entry?.price_basis !== basis) return null
  const conversion = entry.converted
  return conversion && conversion.currency === target ? conversion : null
}

export function parseCurrenciesPayload(raw: unknown): CurrenciesPayload | null {
  const record = asRecord(raw)
  if (!record || !Array.isArray(record.currencies)) return null
  const seen = new Set<string>()
  const currencies: CurrencyOption[] = []
  for (const item of record.currencies) {
    const option = asRecord(item)
    const code = displayCurrencyCode(option?.code)
    if (!option || !code || seen.has(code)) continue
    seen.add(code)
    currencies.push({ code, latestRateDate: text(option.latestRateDate), status: text(option.status) })
  }
  return {
    available: record.available === true,
    reason: text(record.reason),
    pivot: displayCurrencyCode(record.pivot) ?? 'USD',
    maxStalenessBusinessDays: finite(record.maxStalenessBusinessDays),
    currencies,
  }
}

/** True when `code` is one the backend lists and conversion is available. */
export function isListedCurrency(payload: CurrenciesPayload | null, code: string | null): code is string {
  return Boolean(code && payload?.available && payload.currencies.some((option) => option.code === code))
}

/** `href` with the display currency carried over (or removed when null). */
export function withDisplayCurrency(href: string, currency: string | null): string {
  const [pathAndQuery, hash] = href.split('#', 2)
  const [path, query = ''] = pathAndQuery.split('?', 2)
  const params = new URLSearchParams(query)
  if (currency) params.set(DISPLAY_CURRENCY_PARAM, currency)
  else params.delete(DISPLAY_CURRENCY_PARAM)
  const search = params.toString()
  return `${path}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`
}

/** A path with `currency` added to its query, for a backend read. */
export function withCurrencyQuery(path: string, currency: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${DISPLAY_CURRENCY_PARAM}=${encodeURIComponent(currency)}`
}

/* ------------------------------------------------------------------ */
/* Listings we track                                                    */
/* ------------------------------------------------------------------ */

/** One listing of the same company that we track (finance-backend summary `listings.items`). */
export type TrackedListing = {
  symbol: string
  exchange: string | null
  exchangeMic: string | null
  country: string | null
  /** ISO code; the backend scales a minor unit into its parent. */
  currency: string | null
  isPrimary: boolean
  isCurrent: boolean
}

export type TrackedListings = {
  available: boolean
  reason: string | null
  items: TrackedListing[]
}

/**
 * The summary's `listings` block. Null when it is absent or malformed (an older
 * backend): the page then simply says nothing about other listings. Items that
 * cannot be read are dropped, never repaired; an unavailable block has no items.
 */
export function parseTrackedListings(raw: unknown): TrackedListings | null {
  const record = asRecord(raw)
  if (!record || typeof record.available !== 'boolean') return null
  const reason = text(record.reason)
  if (!record.available) return { available: false, reason, items: [] }
  if (!Array.isArray(record.items)) return null
  const seen = new Set<string>()
  const items: TrackedListing[] = []
  for (const value of record.items) {
    const item = asRecord(value)
    const symbol = text(item?.symbol)?.toUpperCase() ?? null
    if (!item || !symbol || !SYMBOL.test(symbol) || seen.has(symbol)) continue
    seen.add(symbol)
    items.push({
      symbol,
      exchange: text(item.exchange),
      exchangeMic: text(item.exchangeMic)?.toUpperCase() ?? null,
      country: text(item.country)?.toUpperCase() ?? null,
      currency: isoCurrency(text(item.currency)),
      isPrimary: item.isPrimary === true,
      isCurrent: item.isCurrent === true,
    })
  }
  // Primary first, then by symbol, as the backend sorts; kept if it ever does not.
  items.sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.symbol.localeCompare(right.symbol))
  return { available: true, reason, items }
}

/* ------------------------------------------------------------------ */
/* The price chart in a display currency                               */
/* ------------------------------------------------------------------ */

/** A day's close as reported, and the backend's conversion of it (null when it has none). */
export type ConvertedClose = {
  price_basis: 'adjusted'
  date: string
  close: number
  converted: number | null
}

/**
 * Daily closes from the backend's `history?currency=XXX` rows. The reported
 * close stays as it is; `converted` is the backend's value for that day, or
 * null when the day has no rate (or is not annotated). Nothing is filled in.
 */
export function convertedClosesFromHistory(rows: unknown, target: string): ConvertedClose[] {
  if (!Array.isArray(rows)) return []
  const byDate = new Map<string, ConvertedClose>()
  for (const value of rows) {
    const row = asRecord(value)
    const date = text(row?.date)?.slice(0, 10) ?? null
    const close = finite(row?.close)
    if (!row || !date || close === null || close <= 0) continue
    if (row.price_basis !== 'adjusted') throw new Error('adjusted_price_input_invalid')
    const conversion = convertedValueOf(row, 'close', target)
    byDate.set(date, { date, close, price_basis: 'adjusted', converted: conversion && conversion.value > 0 ? conversion.value : null })
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

/** Parses the local route's `/api/stocks/{ticker}/history?currency=` answer. */
export function parseConvertedCloses(raw: unknown): ConvertedClose[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((value) => {
    const row = asRecord(value)
    const date = text(row?.date)
    const close = finite(row?.close)
    const converted = row?.converted === null ? null : finite(row?.converted)
    if (!row || !date || close === null || close <= 0 || row.price_basis !== 'adjusted' || (row.converted !== null && (converted === null || converted <= 0))) return []
    return [{ date, close, converted, price_basis: 'adjusted' as const }]
  })
}

export type CurrencyDecomposition = {
  /** First and last day used: the first and last days in the range that have a conversion. */
  from: string
  to: string
  /** The company's return in its listing currency over those days. */
  localReturn: number
  /** The currency's part: (1 + converted) / (1 + local) − 1. */
  currencyEffect: number
  /** The return in the display currency over the same days. */
  convertedReturn: number
  /** Days in the range with a conversion. */
  usedDays: number
  /** Days in the range without one, left out. */
  excludedDays: number
}

/**
 * How a range's return in the display currency splits into the company's
 * return in its own currency and the currency's effect:
 * (1 + r_ccy) = (1 + r_local) · (1 + r_fx). Both returns use the same two
 * days — the first and the last in the range with a conversion — so the
 * split is exact. Days without a conversion are counted and left out.
 * Null when fewer than two days have one.
 */
export function currencyDecomposition(points: readonly ConvertedClose[]): { result: CurrencyDecomposition | null; excludedDays: number } {
  const used = points.filter((point) => point.converted !== null && point.converted > 0 && point.close > 0)
  const excludedDays = points.length - used.length
  if (used.length < 2) return { result: null, excludedDays }
  const first = used[0]
  const last = used[used.length - 1]
  const localReturn = last.close / first.close - 1
  const convertedReturn = (last.converted as number) / (first.converted as number) - 1
  const currencyEffect = (1 + convertedReturn) / (1 + localReturn) - 1
  return {
    result: {
      from: first.date,
      to: last.date,
      localReturn,
      currencyEffect,
      convertedReturn,
      usedDays: used.length,
      excludedDays,
    },
    excludedDays,
  }
}
