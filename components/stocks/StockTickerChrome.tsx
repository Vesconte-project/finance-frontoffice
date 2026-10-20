'use client'

import { use, useEffect, useState } from 'react'
import DisplayCurrencySelect from '@/components/stocks/DisplayCurrencySelect'
import StockResearchNav from '@/components/stocks/StockResearchNav'
import StockTickerIdentity from '@/components/stocks/StockTickerIdentity'
import WatchlistButton from '@/components/WatchlistButton'
import { useDisplayCurrencyParam } from '@/hooks/useDisplayCurrency'
import { assetMetadataParts } from '@/lib/asset-metadata'
import { formatMoney, formatSignedMoney } from '@/lib/currency'
import { amountView, type Amount, type AmountView } from '@/lib/display-currency'
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

type ConvertedQuote = { price: AmountView | null; change: AmountView | null }

function isAmount(value: unknown): value is Amount {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Amount>
  return typeof candidate.currency === 'string' && (candidate.value === null || typeof candidate.value === 'number')
}

/**
 * The chrome lives in the layout, which never sees the page's `?currency=`, so
 * it reads the converted quote from the local route. Until it arrives (or if it
 * fails) the quote shows as reported, which is always true.
 */
function useConvertedQuote(ticker: string, currency: string | null): ConvertedQuote | null {
  const [state, setState] = useState<{ key: string; quote: ConvertedQuote | null } | null>(null)
  const key = `${ticker}:${currency ?? ''}`
  useEffect(() => {
    if (!currency) return
    let active = true
    fetch(`/api/stocks/${encodeURIComponent(ticker)}/quote?currency=${encodeURIComponent(currency)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { currency?: unknown; price?: unknown; change?: unknown } | null
        if (!response.ok || !payload || payload.currency !== currency) throw new Error('Converted quote unavailable.')
        return {
          price: isAmount(payload.price) ? amountView(payload.price, formatMoney) : null,
          change: isAmount(payload.change) ? amountView(payload.change, formatSignedMoney) : null,
        }
      })
      .then((quote) => { if (active) setState({ key, quote }) })
      .catch(() => { if (active) setState({ key, quote: null }) })
    return () => { active = false }
  }, [key, ticker, currency])
  return currency && state?.key === key ? state.quote : null
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
  const displayCurrency = useDisplayCurrencyParam()
  const converted = useConvertedQuote(resolved.ticker, displayCurrency)

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
          currencyControl={<DisplayCurrencySelect listingCurrency={resolved.currency} />}
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
