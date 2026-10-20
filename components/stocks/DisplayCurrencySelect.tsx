'use client'

import { useEffect, useId, useRef, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  readStoredDisplayCurrency,
  useDisplayCurrencies,
  useDisplayCurrencyParam,
  writeStoredDisplayCurrency,
} from '@/hooks/useDisplayCurrency'
import { DISPLAY_CURRENCY_PARAM, isoCurrency } from '@/lib/display-currency'
import styles from './DisplayCurrencySelect.module.css'

/**
 * The ticker page's display currency. The options are the currencies the
 * backend lists, and nothing else; the first one shows every amount as
 * reported, in the listing's own currency. The choice is kept in the URL
 * (`?currency=`) and in this browser (localStorage) until the account
 * preference exists. Every conversion is the backend's: choosing a currency
 * reloads the page's reads with `?currency=`.
 */
export default function DisplayCurrencySelect({ listingCurrency }: { listingCurrency: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = useDisplayCurrencyParam()
  const currencies = useDisplayCurrencies()
  const [pending, startTransition] = useTransition()
  const restored = useRef(false)
  const unavailableId = useId()

  const listing = isoCurrency(listingCurrency)
  const available = currencies.status === 'ready' && currencies.payload.available
  const options = available ? currencies.payload.currencies.filter((option) => option.code !== listing) : []
  const value = current && options.some((option) => option.code === current) ? current : ''

  const show = (code: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (code) params.set(DISPLAY_CURRENCY_PARAM, code)
    else params.delete(DISPLAY_CURRENCY_PARAM)
    const query = params.toString()
    startTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
    })
  }

  // A page opened without `?currency=` follows the reader's last choice.
  useEffect(() => {
    if (restored.current || currencies.status !== 'ready') return
    restored.current = true
    if (current) return
    const stored = readStoredDisplayCurrency()
    if (stored && currencies.payload.available && currencies.payload.currencies.some((option) => option.code === stored && option.code !== listing)) {
      show(stored)
    }
    // `show` reads the latest URL; running once per mount is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencies.status])

  const unavailable = currencies.status === 'error' || (currencies.status === 'ready' && !currencies.payload.available)
  const reportedLabel = listing ?? listingCurrency ?? 'Reported'

  return (
    <label className={styles.control} data-display-currency="" data-pending={pending || undefined}>
      <span className="sr-only">Show amounts in</span>
      {/* The visible face: just the code, so the control fits beside the watchlist at any width. */}
      <span className={styles.face} aria-hidden="true" data-converted={value ? '' : undefined}>
        {value || reportedLabel}
      </span>
      <select
        className={styles.select}
        value={value}
        disabled={currencies.status !== 'ready' || unavailable}
        aria-busy={pending || currencies.status === 'loading' || undefined}
        aria-describedby={unavailable ? unavailableId : undefined}
        title={unavailable ? 'Other currencies are unavailable right now.' : 'Show amounts in another currency'}
        onChange={(event) => {
          const code = event.target.value || null
          writeStoredDisplayCurrency(code)
          show(code)
        }}
      >
        <option value="">{`${reportedLabel} · as reported`}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.status === 'stale' ? `${option.code} · older rates` : option.code}
          </option>
        ))}
      </select>
      {unavailable ? <span id={unavailableId} className="sr-only">Other currencies are unavailable right now.</span> : null}
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? 'Updating amounts.' : ''}
      </span>
    </label>
  )
}
