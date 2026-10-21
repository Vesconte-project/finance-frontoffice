'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  DISPLAY_CURRENCY_PARAM,
  displayCurrencyCode,
  parseCurrenciesPayload,
  type CurrenciesPayload,
} from '@/lib/display-currency'

/**
 * The display currency in the URL (`?currency=`), or null for none. The URL is
 * the only place it lives: no browser storage, no account preference.
 */
export function useDisplayCurrencyParam(): string | null {
  const searchParams = useSearchParams()
  return displayCurrencyCode(searchParams?.get(DISPLAY_CURRENCY_PARAM) ?? null)
}

export type CurrenciesState =
  | { status: 'loading'; payload: null }
  | { status: 'ready'; payload: CurrenciesPayload }
  | { status: 'error'; payload: null }

let currenciesRequest: Promise<CurrenciesPayload> | null = null

function loadCurrencies(): Promise<CurrenciesPayload> {
  currenciesRequest ??= fetch('/api/currencies')
    .then(async (response) => {
      const payload = parseCurrenciesPayload(await response.json().catch(() => null))
      if (!response.ok || !payload) throw new Error('Currency list unavailable.')
      return payload
    })
    .catch((error: unknown) => {
      // Let a later mount try again.
      currenciesRequest = null
      throw error
    })
  return currenciesRequest
}

/** The currencies the backend lists, loaded once per page session. */
export function useDisplayCurrencies(): CurrenciesState {
  const [state, setState] = useState<CurrenciesState>({ status: 'loading', payload: null })
  useEffect(() => {
    let active = true
    loadCurrencies()
      .then((payload) => { if (active) setState({ status: 'ready', payload }) })
      .catch(() => { if (active) setState({ status: 'error', payload: null }) })
    return () => { active = false }
  }, [])
  return state
}

export { DISPLAY_CURRENCY_PARAM }
