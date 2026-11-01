'use client'

import { use, useEffect, useState } from 'react'
import DisplayCurrencySelect from '@/components/stocks/DisplayCurrencySelect'
import StockResearchNav from '@/components/stocks/StockResearchNav'
import StockTickerIdentity, { type ConvertedPrice } from '@/components/stocks/StockTickerIdentity'
import WatchlistButton from '@/components/WatchlistButton'
import { useDisplayCurrencyParam } from '@/hooks/useDisplayCurrency'
import { assetMetadataParts } from '@/lib/asset-metadata'
import { formatMoney } from '@/lib/currency'
import { isoCurrency } from '@/lib/display-currency'
import type { StockTickerChromeData } from '@/lib/stock-ticker-chrome'
import { tickerIdentityColor } from '@/lib/ticker-identity-color'
import styles from './StockTickerChrome.module.css'

export function StockTickerChromeFallback({
  ticker,
  isOverview,
}: {
  ticker: string
  isOverview: boolean
}) {
  const identityColor = tickerIdentityColor(ticker)

  return (
    <section className={styles.chrome} data-ticker-hero="" data-ticker-chrome="loading" aria-label={`${ticker} research`}>
      <div className={styles.content}>
        <StockTickerIdentity
          ticker={ticker}
          displayName={ticker}
          currency=""
          price={null}
          dailyMoveAmount={null}
          dailyMovePercent={null}
          identityColor={identityColor}
          nameAsHeading={isOverview}
          loading
        />
        <div className={styles.navigation} data-ticker-navigation="" data-chrome-collision=""><StockResearchNav ticker={ticker} /></div>
      </div>
    </section>
  )
}

const rateDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatRateDay(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? rateDay.format(parsed) : null
}

/**
 * The chrome lives in the layout, which never sees the page's `?currency=`, so
 * it reads the converted price from the local route. Until it arrives, or when
 * there is no conversion, the header shows the reported price alone.
 */
function useConvertedPrice(ticker: string, currency: string | null): ConvertedPrice | null {
  const [state, setState] = useState<{ key: string; price: ConvertedPrice | null } | null>(null)
  const key = `${ticker}:${currency ?? ''}`
  useEffect(() => {
    if (!currency) return
    let active = true
    fetch(`/api/stocks/${encodeURIComponent(ticker)}/quote?currency=${encodeURIComponent(currency)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          currency?: unknown
          converted?: { value?: unknown; currency?: unknown; rateDate?: unknown } | null
        } | null
        if (!response.ok || !payload || payload.currency !== currency) throw new Error('Converted price unavailable.')
        const converted = payload.converted
        if (!converted || converted.currency !== currency || typeof converted.value !== 'number' || !Number.isFinite(converted.value)) return null
        return { text: formatMoney(converted.value, currency), currency, rateDate: formatRateDay(converted.rateDate) }
      })
      .then((price) => { if (active) setState({ key, price }) })
      .catch(() => { if (active) setState({ key, price: null }) })
    return () => { active = false }
  }, [key, ticker, currency])
  return currency && state?.key === key ? state.price : null
}

export default function StockTickerChrome({
  data,
  isOverview,
}: {
  data: Promise<StockTickerChromeData>
  isOverview: boolean
}) {
  const resolved = use(data)
  const metadata = assetMetadataParts(resolved.assetBadgeLabel, resolved.exchange, resolved.currency)
  const requestedCurrency = useDisplayCurrencyParam()
  // The listing's own currency is no conversion.
  const displayCurrency = requestedCurrency && requestedCurrency !== isoCurrency(resolved.currency) ? requestedCurrency : null
  const converted = useConvertedPrice(resolved.ticker, displayCurrency)

  return (
    <section className={styles.chrome} data-ticker-hero="" data-ticker-chrome="ready" aria-label={`${resolved.ticker} research`}>
      <div className={styles.content}>
        <StockTickerIdentity
          ticker={resolved.ticker}
          displayName={resolved.displayName}
          currency={resolved.currency}
          price={resolved.price}
          dailyMoveAmount={resolved.dailyMoveAmount}
          dailyMovePercent={resolved.dailyMovePercent}
          identityColor={resolved.identityColor}
          nameAsHeading={isOverview}
          metadata={metadata}
          converted={converted}
          currencyControl={(
            <DisplayCurrencySelect
              ticker={resolved.ticker}
              displayName={resolved.displayName}
              listingCurrency={resolved.currency}
              listings={resolved.listings}
            />
          )}
          actions={(
            <>
              <WatchlistButton
                ticker={resolved.ticker}
                initialInWatchlist={resolved.watchlist.initialInWatchlist}
                signedIn={resolved.watchlist.signedIn}
                unavailable={resolved.watchlist.unavailable}
              />
            </>
          )}
        />
        <div className={styles.navigation} data-ticker-navigation="" data-chrome-collision=""><StockResearchNav ticker={resolved.ticker} /></div>
      </div>
    </section>
  )
}
