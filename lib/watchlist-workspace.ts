import { getRecentAiResearchRuns, type AiResearchRun } from '@/lib/ai-research'
import { getTickerScorecards } from '@/lib/scorecard'
import type { Scorecard } from '@/lib/scorecard-types'
import { getLastFlipDatesByTicker, getScreenerSignals, type ScreenerSignal } from '@/lib/signals'
import { getUserWatchlistTickers } from '@/lib/watchlist'

export type WatchlistWorkspaceRow = {
  ticker: string
  row: ScreenerSignal | undefined
  direction: ScreenerSignal['direction'] | null
  lastFlippedDate: string | null
  scorecard: Scorecard
}

export type WatchlistWorkspaceData = {
  tickers: string[]
  watchlistRows: WatchlistWorkspaceRow[]
  recentAiRuns: AiResearchRun[]
  avgConviction: number | null
  bullishCount: number
  flipsLast30d: number
  topConvictionRow: WatchlistWorkspaceRow | null
  latestFlipRow: WatchlistWorkspaceRow | null
}

function isWithinDays(value: string | null, days: number): boolean {
  if (!value) return false
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return false
  return Date.now() - parsed <= days * 24 * 60 * 60 * 1000
}

function timestampOrZero(value: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getWatchlistWorkspace(): Promise<WatchlistWorkspaceData> {
  const tickers = await getUserWatchlistTickers()
  const [{ rows }, lastFlipByTicker, recentAiRuns, scorecardsByTicker] = await Promise.all([
    getScreenerSignals({ tickers, limit: 500 }),
    getLastFlipDatesByTicker(tickers),
    getRecentAiResearchRuns({ limit: 6 }),
    getTickerScorecards(tickers),
  ])

  const rowByTicker = new Map(rows.map((row) => [row.ticker, row]))
  const watchlistRows = tickers.map((ticker) => {
    const row = rowByTicker.get(ticker)
    const direction = row?.direction ?? null
    const lastFlippedDate = lastFlipByTicker[ticker] ?? row?.signalDate ?? null

    return {
      ticker,
      row,
      direction,
      lastFlippedDate,
      scorecard: scorecardsByTicker[ticker],
    }
  }).filter((entry): entry is WatchlistWorkspaceRow => Boolean(entry.scorecard))

  const convictionRows = watchlistRows
    .map((entry) => entry.row?.conviction ?? null)
    .filter((value): value is number => value !== null && Number.isFinite(value))

  const avgConviction =
    convictionRows.length > 0
      ? convictionRows.reduce((sum, value) => sum + value, 0) / convictionRows.length
      : null

  const bullishCount = watchlistRows.filter((entry) => entry.direction === 'bullish').length
  const flipsLast30d = watchlistRows.filter((entry) => isWithinDays(entry.lastFlippedDate, 30)).length

  const topConvictionRow =
    [...watchlistRows]
      .filter((entry) => entry.row?.conviction !== null && entry.row?.conviction !== undefined)
      .sort((left, right) => (right.row?.conviction ?? 0) - (left.row?.conviction ?? 0))[0] ?? null

  const latestFlipRow =
    [...watchlistRows]
      .filter((entry) => entry.lastFlippedDate)
      .sort((left, right) => timestampOrZero(right.lastFlippedDate) - timestampOrZero(left.lastFlippedDate))[0] ??
    null

  return {
    tickers,
    watchlistRows,
    recentAiRuns,
    avgConviction,
    bullishCount,
    flipsLast30d,
    topConvictionRow,
    latestFlipRow,
  }
}
