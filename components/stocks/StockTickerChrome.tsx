'use client'

import { use } from 'react'
import StockResearchNav from '@/components/stocks/StockResearchNav'
import TickerExportButton from '@/components/stocks/TickerExportButton'
import StockTickerIdentity from '@/components/stocks/StockTickerIdentity'
import WatchlistButton from '@/components/WatchlistButton'
import { assetMetadataParts } from '@/lib/asset-metadata'
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

export default function StockTickerChrome({
  data,
  isOverview,
}: {
  data: Promise<StockTickerChromeData>
  isOverview: boolean
}) {
  const resolved = use(data)
  const metadata = assetMetadataParts(resolved.assetBadgeLabel, resolved.exchange, resolved.currency)

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
          actions={(
            <>
              <TickerExportButton ticker={resolved.ticker} signedIn={resolved.watchlist.signedIn} />
              <WatchlistButton
                ticker={resolved.ticker}
                initialInWatchlist={resolved.watchlist.initialInWatchlist}
                signedIn={resolved.watchlist.signedIn}
              />
            </>
          )}
        />
        <div className={styles.navigation} data-ticker-navigation="" data-chrome-collision=""><StockResearchNav ticker={resolved.ticker} /></div>
      </div>
    </section>
  )
}
