'use client'

import { Suspense, use, useMemo } from 'react'
import StockResearchNav from '@/components/stocks/StockResearchNav'
import TickerExportButton from '@/components/stocks/TickerExportButton'
import StockTickerIdentity from '@/components/stocks/StockTickerIdentity'
import TickerRelationshipField, { TickerRelationshipFieldFallback } from '@/components/stocks/TickerRelationshipField'
import WatchlistButton from '@/components/WatchlistButton'
import { assetMetadata } from '@/lib/asset-metadata'
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
      <TickerRelationshipFieldFallback accentColor={identityColor} />
      <div className={styles.content}>
        <div className={styles.identityRow}>
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
        </div>
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
  const relationships = useMemo(() => Promise.resolve(resolved.relationships), [resolved.relationships])
  const metadata = assetMetadata(resolved.assetBadgeLabel, resolved.exchange, resolved.currency)

  return (
    <section className={styles.chrome} data-ticker-hero="" data-ticker-chrome="ready" aria-label={`${resolved.ticker} research`}>
      <Suspense fallback={<TickerRelationshipFieldFallback accentColor={resolved.identityColor} />}>
        <TickerRelationshipField ticker={resolved.ticker} accentColor={resolved.identityColor} relationships={relationships} />
      </Suspense>
      <div className={styles.content}>
        <div className={styles.identityRow}>
          <StockTickerIdentity
            ticker={resolved.ticker}
            displayName={resolved.displayName}
            currency={resolved.currency}
            price={resolved.price}
            dailyMoveAmount={resolved.dailyMoveAmount}
            dailyMovePercent={resolved.dailyMovePercent}
            identityColor={resolved.identityColor}
            nameAsHeading={isOverview}
          />
          <div className={styles.controlRail}>
            {metadata ? <span className={styles.metadata}>{metadata}</span> : null}
            <div className={styles.actionCluster}>
              <TickerExportButton ticker={resolved.ticker} />
              <WatchlistButton
                ticker={resolved.ticker}
                initialInWatchlist={resolved.watchlist.initialInWatchlist}
                signedIn={resolved.watchlist.signedIn}
              />
            </div>
          </div>
        </div>
        <div className={styles.navigation} data-ticker-navigation="" data-chrome-collision=""><StockResearchNav ticker={resolved.ticker} /></div>
      </div>
    </section>
  )
}
