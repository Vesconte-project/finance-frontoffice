/**
 * Where one company stands in each investor reading, as rows for the ticker page.
 *
 * Implements Spec "Ticker reading standings V1" (accepted Snapshot
 * snap-sha256-1b86aad9c9747594f6169a428af18e28038a9e502c9b1a831d8fa88c34e08e67).
 * Deliberately free of `server-only` and I/O so the rules can be unit-tested: the
 * fetch lives in `lib/canonical-research.ts` and the tier decision in the page.
 *
 * The rows are built on the server. A signed-out reader receives only the sign-up
 * row, so no standing, percentage or absence reason ever reaches their browser.
 */

import { PICK_READING_CONTENT, PICK_READING_KEYS, PICK_READING_TO_SLUG, type PickReadingKey } from './picks-content'

export type ReadingStanding = {
  position: number
  universeSize: number
}

export type ReadingItem =
  | { reading: PickReadingKey; status: 'ranked'; standing: ReadingStanding; absenceReason: null }
  | { reading: PickReadingKey; status: 'absent'; standing: null; absenceReason: string }

export type TickerReadings = {
  ticker: string
  readings: ReadingItem[]
}

/** One row in the verdicts list beside the Research score. */
export type ReadingVerdict = {
  key: string
  label: string
  value: string
  detail: string | null
  href: string | null
  /** Set only on the sign-up row, which carries the existing auth analytics. */
  analyticsId: string | null
}

const ABSENCE_COPY: Record<string, string> = {
  pays_no_dividend: 'Pays no dividend',
  ineligible_asset_type: 'Not ranked · not a company',
  insufficient_coverage: 'Not ranked · too little data',
  reading_not_materialized: 'Not available yet',
  not_tracked: 'Not tracked',
}

const UNKNOWN_ABSENCE_COPY = 'Not ranked'

/**
 * The only derivation the Spec allows (§4.3, founder decision D-2).
 *
 * At or above the median: `Top N%`, N = ceil(position / universe × 100).
 * Below it: `Bottom N%`, N = ceil((universe − position + 1) / universe × 100).
 * N is never below 1.
 */
export function formatStandingPercent(position: number, universeSize: number): string {
  if (position * 2 <= universeSize) {
    return `Top ${Math.max(1, Math.ceil((position / universeSize) * 100))}%`
  }
  return `Bottom ${Math.max(1, Math.ceil(((universeSize - position + 1) / universeSize) * 100))}%`
}

export function absenceCopy(reason: string): string {
  return ABSENCE_COPY[reason] ?? UNKNOWN_ABSENCE_COPY
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

/**
 * Accept the backend payload only if it is exactly what the contract promises:
 * three items, each reading once, each either ranked with a valid standing or
 * absent with a reason. Anything else returns null and the rows are omitted.
 */
export function parseTickerReadings(raw: unknown): TickerReadings | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as { ticker?: unknown; readings?: unknown }
  if (typeof payload.ticker !== 'string' || !Array.isArray(payload.readings)) return null
  if (payload.readings.length !== PICK_READING_KEYS.length) return null

  const byKey = new Map<PickReadingKey, ReadingItem>()
  for (const entry of payload.readings) {
    if (!entry || typeof entry !== 'object') return null
    const item = entry as { reading?: unknown; status?: unknown; standing?: unknown; absenceReason?: unknown }
    const reading = item.reading
    if (typeof reading !== 'string' || !(PICK_READING_KEYS as readonly string[]).includes(reading)) return null
    const key = reading as PickReadingKey
    if (byKey.has(key)) return null

    const hasStanding = item.standing !== null && item.standing !== undefined
    const hasReason = typeof item.absenceReason === 'string' && item.absenceReason.length > 0
    if (hasStanding === hasReason) return null

    if (hasStanding) {
      const standing = item.standing as { position?: unknown; universeSize?: unknown }
      if (item.status !== 'ranked') return null
      if (!isPositiveInteger(standing.position) || !isPositiveInteger(standing.universeSize)) return null
      if (standing.position > standing.universeSize) return null
      byKey.set(key, {
        reading: key,
        status: 'ranked',
        standing: { position: standing.position, universeSize: standing.universeSize },
        absenceReason: null,
      })
    } else {
      if (item.status !== 'absent') return null
      byKey.set(key, { reading: key, status: 'absent', standing: null, absenceReason: item.absenceReason as string })
    }
  }

  return { ticker: payload.ticker, readings: PICK_READING_KEYS.map((key) => byKey.get(key) as ReadingItem) }
}

/** Rows for a signed-in reader, in the order Long term, Income, Short term. */
export function readingVerdicts(readings: TickerReadings): ReadingVerdict[] {
  return readings.readings.map((item) => {
    const label = PICK_READING_CONTENT[item.reading].label
    if (item.status === 'ranked') {
      return {
        key: item.reading,
        label,
        value: formatStandingPercent(item.standing.position, item.standing.universeSize),
        detail: null,
        href: `/picks/${PICK_READING_TO_SLUG[item.reading]}`,
        analyticsId: null,
      }
    }
    return { key: item.reading, label, value: absenceCopy(item.absenceReason), detail: null, href: null, analyticsId: null }
  })
}

/** The single row a signed-out reader sees in place of the three. */
export function signedOutReadingVerdict(ticker: string): ReadingVerdict {
  return {
    key: 'readings-sign-up',
    label: 'Readings',
    value: 'Free account',
    detail: `Create a free account to see where ${ticker} stands in each reading.`,
    href: '/sign-up',
    analyticsId: 'ticker_readings_sign_up',
  }
}
