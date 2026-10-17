import { getRecentAiResearchRuns, type AiResearchRun } from '@/lib/ai-research'
import { getTickerScorecards } from '@/lib/scorecard'
import type { Scorecard } from '@/lib/scorecard-types'
import { getUserWatchlistTickers } from '@/lib/watchlist'

export type WatchlistWorkspaceRow = { ticker: string; scorecard: Scorecard | null }
export type WatchlistWorkspaceData = {
  tickers: string[]
  watchlistRows: WatchlistWorkspaceRow[]
  recentAiRuns: AiResearchRun[]
}

export async function getWatchlistWorkspace(): Promise<WatchlistWorkspaceData> {
  const tickers = await getUserWatchlistTickers()
  const [recentAiRuns, scorecards] = await Promise.all([
    getRecentAiResearchRuns({ limit: 6 }), getTickerScorecards(tickers),
  ])
  return { tickers, recentAiRuns,
    watchlistRows: tickers.map(ticker => ({ ticker, scorecard: scorecards[ticker] ?? null })) }
}
