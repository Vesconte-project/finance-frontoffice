import 'server-only'

import { getViewerAccess } from './billing'
import { getPickRanking, normalizePickRanking, type PickFilters, type PickItem } from './picks'
import { platformAccess, platformEnabled } from './platform-server'
import { PlatformError } from './platform-client'
import { cutToTier, tierFor, type PickTier } from './picks-access-rules'
import type { PickReadingKey } from './picks-content'

/**
 * The single place that decides how much of a ranking a viewer actually receives.
 *
 * `server-only` is load-bearing, not decoration: importing this from a Client
 * Component is a build error, which is what stops a full list from ever being
 * serialised into an RSC payload by accident.
 *
 * The rule it enforces: rows a viewer is not entitled to must never reach the browser
 * in any form. Rendering twenty-five rows and hiding fifteen with CSS, or handing all
 * twenty-five to a component that maps only ten, both fail — the data is in the
 * payload either way. The cut happens here, before anything is passed to a component.
 */

export type { PickTier } from './picks-access-rules'
export { PICK_VISIBLE_LIMITS } from './picks-access-rules'

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

/**
 * Resolve one ranking for the current viewer.
 *
 * The upstream read is cached and shared between viewers (see `getPickRanking`),
 * which is safe because it never leaves the server. The cut below is per request,
 * against the live session, and is never cached. Pages calling this must be dynamic:
 * a cached page would hand one viewer's HTML to the next.
 */
export async function resolveVisiblePicks(reading: PickReadingKey, options: { publicPage?: boolean } = {}): Promise<VisiblePicks> {
  if (platformEnabled() && !options.publicPage) {
    try {
      const { account, access, request } = await platformAccess()
      if (access.features['rankings.read']?.allowed !== true) return { status: 'locked', reading, tier: 'free' }
      const response = await request(`/rankings?account_id=${account.id}&reading=${reading}&limit=25`)
      const ranking = normalizePickRanking(await response.json(), reading)
      if (!ranking) return { status: 'unavailable', reading, tier: 'pro' }
      // FastAPI has authorized this account's exact feature. No shared cache,
      // Clerk plan metadata or frontend tier arithmetic grants access here.
      return { status: 'ok', reading, tier: 'pro', asOf: ranking.asOf,
        filters: ranking.filters, items: ranking.items, lockedCount: 0, totalRanked: ranking.items.length }
    } catch (error) {
      if (error instanceof PlatformError && [401, 403].includes(error.status))
        return { status: 'locked', reading, tier: error.status === 401 ? 'anonymous' : 'free' }
      return { status: 'unavailable', reading, tier: 'anonymous' }
    }
  }
  const viewer = await getViewerAccess(options)
  const tier = tierFor(viewer)

  let ranking: Awaited<ReturnType<typeof getPickRanking>> = null
  try {
    ranking = await getPickRanking(reading)
  } catch (error) {
    // Logged rather than swallowed: an unavailable ranking is a backend problem the
    // page cannot describe, and the reader only sees "temporarily unavailable".
    console.error('[picks] ranking unavailable', {
      reading,
      message: error instanceof Error ? error.message : String(error),
    })
    return { status: 'unavailable', reading, tier }
  }

  if (!ranking) return { status: 'unavailable', reading, tier }

  const cut = cutToTier(ranking.items, tier)

  return {
    status: 'ok',
    reading,
    tier,
    asOf: ranking.asOf,
    filters: ranking.filters,
    items: cut.items,
    lockedCount: cut.lockedCount,
    totalRanked: cut.totalRanked,
  }
}
