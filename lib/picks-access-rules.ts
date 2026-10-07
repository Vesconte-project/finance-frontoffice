/**
 * The entitlement rules for picks rankings, kept pure so they can be tested.
 *
 * Deliberately free of `server-only`, imports and I/O. Nothing here is secret — that
 * only Pro readers see rows is on the page in words. What must not leak is the
 * data, and that is enforced in `lib/picks-access.ts`, which is server-only and is
 * the only caller of `cutToTier` that touches a real ranking.
 *
 * Keeping the arithmetic separate means the invariant that matters — a viewer never
 * receives more rows than their tier allows — is covered by a plain unit test instead
 * of resting on a component being written correctly.
 */

export type PickTier = 'anonymous' | 'free' | 'pro'

/** Matches PICK_FETCH_LIMIT in lib/picks.ts; duplicated to keep this module pure. */
export const PICK_FULL_LIST = 25

/**
 * How many ranked rows each tier sees.
 *
 * The current ranking is the paid product (founder decision, Oct 2026): anyone else
 * gets the methodology, the disclosure and a count, never a name. What is free is a
 * company's own standing on its page and the weekly cut, both served elsewhere.
 * Until billing opens, `pro` only exists for accounts flagged by hand.
 */
export const PICK_VISIBLE_LIMITS: Record<PickTier, number> = {
  anonymous: 0,
  free: 0,
  pro: PICK_FULL_LIST,
}

export function tierFor(viewer: { isSignedIn: boolean; isPro: boolean }): PickTier {
  if (viewer.isPro) return 'pro'
  if (viewer.isSignedIn) return 'free'
  return 'anonymous'
}

export type PickCut<T> = {
  items: T[]
  /** How many rows sit above the cut. A count carries no ticker with it. */
  lockedCount: number
  totalRanked: number
  visibleLimit: number
}

/**
 * Cut a ranking to what a tier may see.
 *
 * Returns a new array. The caller must discard the input rather than keep it around
 * to pass somewhere else — the whole point is that the rows above the cut stop
 * existing before anything is rendered.
 */
export function cutToTier<T>(items: readonly T[], tier: PickTier): PickCut<T> {
  const visibleLimit = PICK_VISIBLE_LIMITS[tier]
  const totalRanked = items.length
  const visible = items.slice(0, visibleLimit)

  return {
    items: visible,
    lockedCount: Math.max(0, totalRanked - visible.length),
    totalRanked,
    visibleLimit,
  }
}
