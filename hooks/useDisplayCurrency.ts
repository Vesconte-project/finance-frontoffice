'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  DISPLAY_CURRENCY_PARAM,
  DISPLAY_CURRENCY_STORAGE_KEY,
  displayCurrencyCode,
  parseCurrenciesPayload,
  type CurrenciesPayload,
} from '@/lib/display-currency'

/** The display currency in the URL (`?currency=`), or null for amounts as reported. */
export function useDisplayCurrencyParam(): string | null {
  const searchParams = useSearchParams()
  return displayCurrencyCode(searchParams?.get(DISPLAY_CURRENCY_PARAM) ?? null)
}

/**
 * The reader's last choice, kept in this browser only until the account
 * preference exists. `''` means "as reported"; null means no choice was made
 * (or storage is unavailable).
 */
export function readStoredDisplayCurrency(): string | null {
  try {
    const raw = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY)
    if (raw === '') return ''
    return displayCurrencyCode(raw)
  } catch {
    return null
  }
}

export function writeStoredDisplayCurrency(currency: string | null): void {
  try {
    window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, currency ?? '')
  } catch {
    // Private windows and blocked storage keep the choice in the URL only.
  }
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
