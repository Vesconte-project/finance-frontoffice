import 'server-only'

import { getViewerUserId } from '@/lib/auth'
import { currencyForTicker } from '@/lib/currency'
import { getTickerRelationships, rankTickerRelationshipCandidates } from '@/lib/relationships'
import { stockAssetKind } from '@/lib/stock-asset-kind'
import { getTickerPageSummary } from '@/lib/ticker-data'
import { tickerIdentityColor } from '@/lib/ticker-identity-color'
import { isTickerInWatchlist } from '@/lib/watchlist'

export type StockTickerChromeData = {
  ticker: string
  displayName: string
  assetBadgeLabel: 'ETF' | 'Equity'
  currency: string
  exchange: string | null
  price: number | null
  dailyMoveAmount: number | null
  dailyMovePercent: number | null
  identityColor: string
  watchlist: {
    signedIn: boolean
    initialInWatchlist: boolean
  }
  relationships: Array<{
    symbol: string
    strength: number | null
    confidence: number | null
  }>
}

export async function getStockTickerChromeData(tickerRaw: string): Promise<StockTickerChromeData> {
  const ticker = tickerRaw.trim().toUpperCase()
  const viewerUserIdPromise = getViewerUserId()
  const watchlistPromise = viewerUserIdPromise.then((userId) =>
    userId ? isTickerInWatchlist(userId, ticker).catch(() => false) : false
  )
  const [summary, relationships, viewerUserId, initialInWatchlist] = await Promise.all([
    getTickerPageSummary(ticker).catch(() => null),
    getTickerRelationships(ticker, { window: 252, topK: 50 }).catch(() => null),
    viewerUserIdPromise,
    watchlistPromise,
  ])

  const quote = summary?.quote
  const displayName = quote?.name?.trim() || ticker
  const kind = summary
    ? stockAssetKind({ ticker, name: displayName, latestFundamentals: summary.latestFundamentals })
    : 'equity'
  const fieldNodes = relationships
    ? rankTickerRelationshipCandidates(relationships, ticker).map(({ symbol, strength, confidence }) => ({
        symbol,
        strength,
        confidence,
      }))
    : []

  return {
    ticker,
    displayName,
    assetBadgeLabel: kind === 'fund' ? 'ETF' : 'Equity',
    currency: summary?.asset?.currency ?? summary?.fundamentalsSummary?.currency ?? currencyForTicker(ticker),
    exchange: summary?.asset?.exchange ?? null,
    price: quote?.price ?? summary?.marketStats?.lastPrice ?? null,
    dailyMoveAmount: quote?.change ?? null,
    dailyMovePercent: quote?.changePercent ?? null,
    identityColor: tickerIdentityColor(ticker),
    watchlist: {
      signedIn: Boolean(viewerUserId),
      initialInWatchlist,
    },
    relationships: fieldNodes,
  }
}
