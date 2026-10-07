/**
 * The weekly free ranking: one reading, one sector, ten names, open to everyone.
 *
 * Which pair runs is pure arithmetic on the date, so the choice is automatic and
 * the same for every reader — nobody at Vesconte picks the week. Over 33 weeks
 * every sector runs once under every reading.
 *
 * Deliberately free of `server-only` and I/O so the rotation is unit-tested.
 */

import { PICK_READING_KEYS, type PickReadingKey } from './picks-content'

/**
 * Sector names exactly as the backend reports them on ranking items.
 * TODO(backend): confirm against the registry's sector values when the
 * `sector` filter on /screener/rankings ships.
 */
export const WEEKLY_SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Consumer Cyclical',
  'Communication Services',
  'Utilities',
  'Basic Materials',
  'Real Estate',
] as const

export const WEEKLY_CUT_SIZE = 10

export type WeeklyCut = {
  reading: PickReadingKey
  sector: string
  /** Monday the cut started, as YYYY-MM-DD in UTC. */
  weekStart: string
}

const DAY_MS = 86_400_000

/** Whole weeks since the Monday before the Unix epoch (1970-01-01 was a Thursday). */
export function weeksSinceEpoch(date: Date): number {
  const days = Math.floor(date.getTime() / DAY_MS)
  return Math.floor((days + 3) / 7)
}

export function weeklyCutFor(date: Date): WeeklyCut {
  const week = weeksSinceEpoch(date)
  const cycle = PICK_READING_KEYS.length * WEEKLY_SECTORS.length
  const slot = ((week % cycle) + cycle) % cycle
  const reading = PICK_READING_KEYS[slot % PICK_READING_KEYS.length]!
  const sector = WEEKLY_SECTORS[Math.floor(slot / PICK_READING_KEYS.length)]!
  const weekStart = new Date((week * 7 - 3) * DAY_MS).toISOString().slice(0, 10)
  return { reading, sector, weekStart }
}

/**
 * A sector cut is only trustworthy if the backend says it applied the filter and
 * every row agrees. Anything else — an older backend that ignores `sector` and
 * returns the whole market's top ten — must not be shown under a sector heading.
 */
export function isSectorCutValid(
  requestedSector: string,
  reportedSector: string | null,
  itemSectors: readonly (string | null)[],
): boolean {
  const want = requestedSector.trim().toLowerCase()
  if (!reportedSector || reportedSector.trim().toLowerCase() !== want) return false
  return itemSectors.every((sector) => typeof sector === 'string' && sector.trim().toLowerCase() === want)
}
