/**
 * The entitlement rules for picks rankings, kept pure so they can be tested.
 *
 * Deliberately free of `server-only`, imports and I/O. Nothing here is secret — that
 * anonymous readers see five rows is on the page in words. What must not leak is the
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
 * `pro` matches `free` on purpose. The tier exists so Pro-only behaviour has one
 * obvious place to land; until there is something real to give it, handing it a
 * bigger number than the ranking contains would be inventing a benefit.
 */
export const PICK_VISIBLE_LIMITS: Record<PickTier, number> = {
  anonymous: 5,
  free: PICK_FULL_LIST,
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
