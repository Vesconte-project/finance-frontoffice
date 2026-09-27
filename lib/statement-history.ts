/**
 * How much statement history each reader gets, and the window that moves through it.
 *
 * Implements Spec "Financial statements history by plan V1" (accepted Snapshot
 * snap-sha256-40c3bc89ff96b1c945a6cd46961c34d4421c4f156a6052f7e1cb8ae12284b893).
 * Deliberately free of `server-only`, imports and I/O so the rules can be unit-tested:
 * the fetch lives in `lib/canonical-research.ts` and the tier decision in the page.
 *
 * The cut is what keeps history the reader is not entitled to out of their browser.
 * It runs on the server before anything is rendered, and what it returns for the
 * withheld periods is a number — never a value, a date or a label.
 */

export type HistoryTier = 'anonymous' | 'free' | 'pro'
export type HistoryPeriod = 'annual' | 'quarterly'

/** The only fields the cut reads. Structural, so the real payload type fits it. */
export type HistoryRow = { periodEnd: string }
export type HistoryPayload<Row extends HistoryRow> = {
  available: boolean
  rows: Row[]
  truncated?: boolean
}

/** Most recent periods each tier sees (§4.1). `null` is every period we hold. */
export const HISTORY_ALLOWANCE: Record<HistoryTier, Record<HistoryPeriod, number | null>> = {
  anonymous: { annual: 4, quarterly: 16 },
  free: { annual: 8, quarterly: 32 },
  pro: { annual: null, quarterly: null },
}

export type HistoryCut<Key extends string, Payload> = {
  statements: Record<Key, Payload | null>
  /** Periods held for this company that the reader's plan does not open. */
  withheld: number
  /**
   * The same, per statement: only the withheld periods that statement itself
   * has rows for. A statement whose history starts later is never shown a lock
   * over years it does not hold.
   */
  withheldBy: Record<Key, number>
}

/**
 * Cut every statement on the page to the reader's allowance.
 *
 * A period is a distinct `periodEnd` across all the page's statements, so the
 * income statement and the balance sheet always stop at the same year. The
 * withheld count only counts periods that were actually received: a response the
 * backend truncated says nothing about what lies beyond it, and the locked zone
 * must never claim history the page did not see (§4.5).
 *
 * Returns new payloads. The caller must drop the input rather than pass it on.
 */
export function cutStatementHistory<Payload extends HistoryPayload<HistoryRow>, Key extends string>(
  statements: Record<Key, Payload | null>,
  tier: HistoryTier,
  period: HistoryPeriod,
): HistoryCut<Key, Payload> {
  const payloads = Object.values(statements) as Array<Payload | null>
  const periodEnds = new Set<string>()
  for (const payload of payloads) {
    if (!payload?.available) continue
    for (const row of payload.rows) periodEnds.add(row.periodEnd)
  }

  const newestFirst = [...periodEnds].sort((left, right) => right.localeCompare(left))
  const allowance = HISTORY_ALLOWANCE[tier][period]
  const allowed = new Set(allowance === null ? newestFirst : newestFirst.slice(0, allowance))

  const cut = {} as Record<Key, Payload | null>
  const withheldBy = {} as Record<Key, number>
  for (const key of Object.keys(statements) as Key[]) {
    const payload = statements[key]
    // Same row type in, same row type out: filtering never changes a row.
    cut[key] = payload ? ({ ...payload, rows: payload.rows.filter((row) => allowed.has(row.periodEnd)) } as Payload) : null
    const own = new Set(payload?.available ? payload.rows.map((row) => row.periodEnd) : [])
    withheldBy[key] = [...own].filter((periodEnd) => !allowed.has(periodEnd)).length
  }

  return { statements: cut, withheld: newestFirst.length - allowed.size, withheldBy }
}

/* ---------------------------------------------------------------------------
   The window (§4.2) and the scrubber that moves it (§4.3).

   `start` is the index of the oldest period shown, counted over the allowed
   periods ordered oldest to newest. Withheld periods are never indexable.
   ------------------------------------------------------------------------ */

/** Below this width the window narrows. Matches the Spec's 768px. */
export const WIDE_WINDOW_MIN_WIDTH = 768

export function windowSize(period: HistoryPeriod, wide: boolean): number {
  if (period === 'annual') return wide ? 5 : 3
  return wide ? 8 : 4
}

export function clampStart(start: number, total: number, size: number): number {
  const last = Math.max(0, total - size)
  return Math.min(last, Math.max(0, Math.round(start)))
}

/** The page opens on the most recent periods, newest at the right. */
export function latestStart(total: number, size: number): number {
  return Math.max(0, total - size)
}

/** The keys the slider answers to; any other key is left to the browser. */
export function startForKey(key: string, start: number, total: number, size: number): number | null {
  switch (key) {
    case 'ArrowLeft':
      return clampStart(start - 1, total, size)
    case 'ArrowRight':
      return clampStart(start + 1, total, size)
    case 'PageUp':
      return clampStart(start - size, total, size)
    case 'PageDown':
      return clampStart(start + size, total, size)
    case 'Home':
      return 0
    case 'End':
      return latestStart(total, size)
    default:
      return null
  }
}

/** A click on the track centres the window on the allowed period under it. */
export function startCentredOn(index: number, total: number, size: number): number {
  return clampStart(index - (size - 1) / 2, total, size)
}

/** `FY2019 to FY2023`, `Q1 2024 to Q4 2025` (§6.1). */
export function windowValueText(labels: readonly string[], start: number, size: number): string {
  if (labels.length === 0) return ''
  const first = labels[start] ?? labels[0]
  const last = labels[Math.min(labels.length, start + size) - 1] ?? first
  return first === last ? first : `${first} to ${last}`
}

/* ---------------------------------------------------------------------------
   The locked zone's copy (§6.1).
   ------------------------------------------------------------------------ */

export type LockedHistoryCopy = {
  heading: string
  body: string
  linkLabel: string
  href: string
  /** Set on the sign-up link only, which carries the existing auth analytics. */
  analyticsId: string | null
}

export function lockedHistoryCopy(tier: HistoryTier, period: HistoryPeriod, withheld: number): LockedHistoryCopy | null {
  if (withheld <= 0 || tier === 'pro') return null
  const unit = period === 'annual' ? 'year' : 'quarter'
  const heading = `+${withheld} earlier ${withheld === 1 ? unit : `${unit}s`}`
  if (tier === 'anonymous') {
    return {
      heading,
      body: 'A free account opens 8 years of statements.',
      linkLabel: 'Create a free account',
      href: '/sign-up',
      analyticsId: 'financials_history_sign_up',
    }
  }
  return {
    heading,
    body: 'Full statement history is planned for Pro.',
    linkLabel: 'See plans',
    href: '/pricing',
    analyticsId: null,
  }
}
