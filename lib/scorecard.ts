import { cache } from 'react'
import { BackendDataError, fetchBackendJson } from './backend'
import {
  buildFixtureScorecard,
  normalizeScorecard,
  type Scorecard,
} from './scorecard-types'

const SCORECARD_REVALIDATE_SECONDS = 3600

function normalizeTicker(tickerRaw: string): string {
  return tickerRaw.trim().toUpperCase()
}

async function fetchTickerScorecardFromBackend(tickerRaw: string): Promise<Scorecard> {
  const ticker = normalizeTicker(tickerRaw)
  if (!ticker) return buildFixtureScorecard('UNKNOWN')

  const payload = await fetchBackendJson<unknown>(
    `/v1/tickers/${encodeURIComponent(ticker)}/scorecard`,
    {
      context: 'backend.tickers.scorecard',
      init: {
        cache: 'no-store',
        next: {
          revalidate: SCORECARD_REVALIDATE_SECONDS,
          tags: [`ticker-scorecard:${ticker}`],
        },
      },
    }
  )
  const scorecard = normalizeScorecard(payload)
  if (!scorecard) {
    throw new BackendDataError('backend.tickers.scorecard', 'Invalid scorecard payload shape')
  }
  return scorecard
}

export const getTickerScorecard = cache(async (ticker: string): Promise<Scorecard> => {
    try {
      return await fetchTickerScorecardFromBackend(ticker)
    } catch (error) {
      if (error instanceof BackendDataError && (error.status === 404 || error.status === 405)) {
        return buildFixtureScorecard(ticker)
      }
      throw error
    }
  })

export async function getTickerScorecards(tickers: string[]): Promise<Record<string, Scorecard>> {
  const normalizedTickers = [...new Set(tickers.map(normalizeTicker).filter(Boolean))]
  if (normalizedTickers.length === 0) return {}

  const entries = await Promise.all(
    normalizedTickers.map(async (ticker) => {
      try {
        return [ticker, await getTickerScorecard(ticker)] as const
      } catch {
        return [ticker, buildFixtureScorecard(ticker)] as const
      }
    })
  )

  return Object.fromEntries(entries)
}

export type { Scorecard, ScorecardAxis, ScorecardAxisKey, ScorecardOverall } from './scorecard-types'
export { scoreColor } from './scorecard-types'
