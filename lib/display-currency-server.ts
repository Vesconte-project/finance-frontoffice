import 'server-only'

import { cache } from 'react'
import { BackendDataError, fetchBackendJson } from './backend'
import {
  applyDisplayCurrency,
  displayCurrencyCode,
  emptyReport,
  isListedCurrency,
  parseCurrenciesPayload,
  withCurrencyQuery,
  type CurrenciesPayload,
  type DisplayCurrencyReport,
} from './display-currency'

/** `GET /v1/currencies`: the currencies a ticker read can be shown in. Null when it cannot be read. */
export const getDisplayCurrencies = cache(async (): Promise<CurrenciesPayload | null> => {
  const payload = await fetchBackendJson<unknown>('/v1/currencies', { context: 'backend.currencies', timeoutMs: 5000 })
  return parseCurrenciesPayload(payload)
})

/**
 * The display currency a page was asked for (`?currency=`), when the backend
 * lists it. Anything else, or a list that cannot be read, shows amounts as
 * reported: the page never fails because of the currency choice.
 */
export async function resolveDisplayCurrency(raw: unknown): Promise<string | null> {
  const code = displayCurrencyCode(raw)
  if (!code) return null
  const payload = await getDisplayCurrencies().catch(() => null)
  return isListedCurrency(payload, code) ? code : null
}

/**
 * A ticker read in `currency`, with each annotated amount replaced by its
 * converted value. A 422 (the currency stopped being listed) falls back to the
 * read as reported, flagged in the report.
 */
export async function fetchInDisplayCurrency<T>(
  path: string,
  currency: string | null,
  read: (path: string) => Promise<T>,
): Promise<{ payload: T; report: DisplayCurrencyReport | null }> {
  if (!currency) return { payload: await read(path), report: null }
  try {
    const payload = await read(withCurrencyQuery(path, currency))
    return applyDisplayCurrency(payload, currency)
  } catch (error) {
    if (error instanceof BackendDataError && error.status === 422) {
      return { payload: await read(path), report: { ...emptyReport(currency), unsupported: true } }
    }
    throw error
  }
}
