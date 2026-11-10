import 'server-only'
import { lifecycleView } from '@/lib/listing-lifecycle'

import { getViewerUserId } from '@/lib/auth'
import { currencyForTicker } from '@/lib/currency'
import { parseTrackedListings, type TrackedListings } from '@/lib/display-currency'
import { resolveStockAsset, type StockAssetBadge } from '@/lib/stock-asset-kind'
import { getTickerPageSummary } from '@/lib/ticker-data'
import { tickerIdentityColor } from '@/lib/ticker-identity-color'
import { isTickerInWatchlist } from '@/lib/watchlist'

export type StockTickerChromeData = {
  ticker: string
  displayName: string
  assetBadgeLabel: StockAssetBadge
  currency: string
  exchange: string | null
  price: number | null
  dailyMoveAmount: number | null
  dailyMovePercent: number | null
  identityColor: string
  /** The listings of the same company we track; null when the backend sends none. */
  listings: TrackedListings | null
  watchlist: {
    signedIn: boolean
    initialInWatchlist: boolean
    unavailable?: boolean
  }
}

export async function getStockTickerChromeData(tickerRaw: string): Promise<StockTickerChromeData> {
  const ticker = tickerRaw.trim().toUpperCase()
  const viewerUserIdPromise = getViewerUserId()
  const watchlistPromise = viewerUserIdPromise.then((userId) =>
    userId ? isTickerInWatchlist(ticker).catch(() => null) : false
  )
  const [summary, viewerUserId, initialInWatchlist] = await Promise.all([
    getTickerPageSummary(ticker).catch(() => null),
    viewerUserIdPromise,
    watchlistPromise,
  ])

  const quote = summary?.quote
  const displayName = quote?.name?.trim() || ticker
  const badge: StockAssetBadge = summary
    ? resolveStockAsset({
        assetType: summary.asset?.assetType,
        ticker,
        name: displayName,
        latestFundamentals: summary.latestFundamentals,
      }).badge
    : 'Equity'
  const current = lifecycleView(summary).state === 'available'
  return {
    ticker,
    displayName,
    assetBadgeLabel: badge,
    currency: summary?.asset?.currency ?? summary?.fundamentalsSummary?.currency ?? currencyForTicker(ticker),
    exchange: summary?.asset?.exchange ?? null,
    price: current ? quote?.price ?? summary?.marketStats?.lastPrice ?? null : null,
    dailyMoveAmount: current ? quote?.change ?? null : null,
    dailyMovePercent: current ? quote?.changePercent ?? null : null,
    identityColor: tickerIdentityColor(ticker),
    listings: parseTrackedListings(summary?.listings),
    watchlist: {
      signedIn: Boolean(viewerUserId),
      initialInWatchlist: initialInWatchlist === true,
      unavailable: Boolean(viewerUserId) && initialInWatchlist === null,
    },
  }
}
