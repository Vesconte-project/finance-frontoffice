/**
 * How much of a ranking a viewer of a given tier receives, and what is read to build it.
 *
 * Free of `server-only`, Next and Clerk so the journey can be exercised in tests with the real
 * loaders over a stubbed network (ENG-268). `lib/picks-access.ts` is still the only caller that
 * wires real loaders and the live session; this module never decides the tier itself.
 */
import { PICK_VISIBLE_LIMITS, cutToTier, type PickTier } from './picks-access-rules'
import type { PickReadingKey } from './picks-content'
import type { PickFilters, PickItem, PickRanking, PickRankingSummary } from './picks'

export type VisiblePicks =
  | { status: 'locked'; reading: PickReadingKey; tier: 'anonymous' | 'free' }
  | {
      status: 'ok'
      reading: PickReadingKey
      tier: PickTier
      asOf: string | null
      filters: PickFilters
      /** Already cut to the tier. There is no longer list behind this one. */
      items: PickItem[]
      lockedCount: number
      totalRanked: number
    }
  | {
      status: 'unavailable'
      reading: PickReadingKey
      tier: PickTier
    }

export type PickLoaders = {
  ranking: (reading: PickReadingKey) => Promise<PickRanking | null>
  summary: () => Promise<PickRankingSummary | null>
}

const DEFAULT_FILTERS: PickFilters = { minCoverage: 0, eligibility: null, includeNonCompanies: false,
  nonCompanyRule: null, sector: null }

function logUnavailable(what: string, reading: PickReadingKey, error: unknown) {
  // Logged rather than swallowed: the reader only sees "temporarily unavailable".
  console.error(`[picks] ${what} unavailable`, { reading, message: error instanceof Error ? error.message : String(error) })
}

export async function resolvePicksFor(reading: PickReadingKey, tier: PickTier, loaders: PickLoaders): Promise<VisiblePicks> {
  // Never fetch rows the viewer may not see (ENG-268). Anonymous and free readers get the count
  // from a summary that names no company: fetching the ranking only to cut it to zero spent their
  // whole hourly company budget on names they were never shown.
  if (PICK_VISIBLE_LIMITS[tier] === 0) {
    try {
      const summary = await loaders.summary()
      const totalRanked = summary?.ranked[reading]
      if (!summary || totalRanked === undefined) return { status: 'unavailable', reading, tier }
      return { status: 'ok', reading, tier, asOf: summary.asOf, filters: DEFAULT_FILTERS,
        items: [], lockedCount: totalRanked, totalRanked }
    } catch (error) {
      logUnavailable('ranking summary', reading, error)
      return { status: 'unavailable', reading, tier }
    }
  }
  let ranking: PickRanking | null = null
  try {
    ranking = await loaders.ranking(reading)
  } catch (error) {
    logUnavailable('ranking', reading, error)
    return { status: 'unavailable', reading, tier }
  }
  if (!ranking) return { status: 'unavailable', reading, tier }
  const cut = cutToTier(ranking.items, tier)
  return { status: 'ok', reading, tier, asOf: ranking.asOf, filters: ranking.filters,
    items: cut.items, lockedCount: cut.lockedCount, totalRanked: cut.totalRanked }
}

/** One in-flight or settled call shared by every caller: explicit, so it holds outside React too. */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => (pending ??= load())
}

export type HomeBoardData = Record<PickReadingKey, VisiblePicks>

/** The homepage board: three columns, at most one summary read, never a hidden ranking. */
export async function loadHomeBoardFor(tier: PickTier, loaders: PickLoaders,
  readings: readonly PickReadingKey[] = ['longTerm', 'income', 'shortTerm']): Promise<HomeBoardData> {
  const shared = { ranking: loaders.ranking, summary: once(loaders.summary) }
  const results = await Promise.all(readings.map((reading) => resolvePicksFor(reading, tier, shared)))
  return Object.fromEntries(results.map((result) => [result.reading, result])) as HomeBoardData
}
