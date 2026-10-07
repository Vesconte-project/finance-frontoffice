import 'server-only'

import { unstable_cache } from 'next/cache'
import { fetchBackendJson } from './backend'
import { PICK_FULL_LIST } from './picks-access-rules'
import type { PickReadingKey } from './picks-content'
import { parseEligibilityRule, type EligibilityRule } from './reading-eligibility'

/**
 * Top-N rankings for one scorecard reading.
 *
 * `finance-backend` exposes `GET /screener/rankings?reading=…&limit=…`, which reads
 * the scorecard snapshot once and sorts it. `/tickers/{ticker}/scorecard` answers for
 * a single symbol, so building a top 25 from it would mean 686 requests.
 *
 * Two filters are applied upstream by default and are NOT exposed here as options.
 * Without them a score built from a quarter of the model once topped the long-term
 * list, and a bond ETF sat fourth on the income list. Since Spec "Reading eligibility
 * V1", the first is the feature store's rule (a reading needs its required part and
 * one other) rather than a coverage percentage. The backend reports both in `filters`
 * so a reader seeing 25 of 686 can be told what happened to the rest.
 *
 * Read `readings` as ordering, not as marks out of 100: the curves behind the scores
 * are hand-drawn and uncalibrated. See `finance-feature-store/docs/scorecard.md`.
 */

/** Always the full list. Never derived from anything a client can set. */
export const PICK_FETCH_LIMIT = PICK_FULL_LIST

export type PickComponent = {
  key: string
  label: string
  score: number | null
  available: boolean
  detail: string | null
}

export type PickItem = {
  symbol: string
  name: string | null
  sector: string | null
  score: number
  coverage: number
  /** Income only: how much stock paid a thousand in dividends over the trailing year. */
  capitalPerThousandIncome: number | null
  components: PickComponent[]
}

export type PickFilters = {
  minCoverage: number
  /** The rule a reading was admitted by, from the feature store via the backend. Null before it ships. */
  eligibility: EligibilityRule | null
  includeNonCompanies: boolean
  nonCompanyRule: string | null
}

export type PickRanking = {
  asOf: string | null
  reading: PickReadingKey
  filters: PickFilters
  items: PickItem[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160)
  return null
}

function readFiniteNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeComponent(raw: unknown): PickComponent | null {
  const record = asRecord(raw)
  if (!record) return null

  const key = readString(record, 'key')
  if (!key) return null

  const score = readFiniteNumber(record, 'score')
  return {
    key,
    label: readString(record, 'label') ?? key,
    score,
    available: record.available === true || (record.available == null && score !== null),
    detail: readString(record, 'detail'),
  }
}

function normalizeItem(raw: unknown): PickItem | null {
  const record = asRecord(raw)
  if (!record) return null

  const symbol = readString(record, 'symbol')
  const score = readFiniteNumber(record, 'score')
  // A row with no symbol or no score cannot be ranked, so it is dropped rather
  // than rendered as a gap in a numbered list.
  if (!symbol || score === null) return null

  const components = Array.isArray(record.components)
    ? record.components.map(normalizeComponent).filter((item): item is PickComponent => item !== null)
    : []

  return {
    symbol: symbol.toUpperCase(),
    name: readString(record, 'name'),
    sector: readString(record, 'sector'),
    score: Math.round(score),
    coverage: readFiniteNumber(record, 'coverage') ?? 0,
    capitalPerThousandIncome: readFiniteNumber(record, 'capitalPerThousandIncome'),
    components,
  }
}

function normalizeFilters(raw: unknown): PickFilters {
  const record = asRecord(raw)
  if (!record) return { minCoverage: 0, eligibility: null, includeNonCompanies: false, nonCompanyRule: null }
  return {
    minCoverage: readFiniteNumber(record, 'minCoverage') ?? 0,
    eligibility: parseEligibilityRule(record.eligibility),
    includeNonCompanies: record.includeNonCompanies === true,
    nonCompanyRule: readString(record, 'nonCompanyRule'),
  }
}

export function normalizePickRanking(raw: unknown, reading: PickReadingKey): PickRanking | null {
  const record = asRecord(raw)
  if (!record) return null

  const items = Array.isArray(record.items)
    ? record.items.map(normalizeItem).filter((item): item is PickItem => item !== null)
    : []

  return {
    asOf: readString(record, 'asOf'),
    reading,
    filters: normalizeFilters(record.filters),
    items,
  }
}

async function loadPickRanking(reading: PickReadingKey): Promise<PickRanking | null> {
  const payload = await fetchBackendJson<unknown>(
    `/screener/rankings?reading=${encodeURIComponent(reading)}&limit=${PICK_FETCH_LIMIT}`,
    { context: 'backend.screener.rankings' }
  )
  return normalizePickRanking(payload, reading)
}

/**
 * Caches the FULL upstream ranking. This is safe to share between viewers because it
 * never leaves the server: the per-viewer cut happens after this read, in
 * `lib/picks-access.ts`. Caching an already-cut list here would serve one viewer's
 * entitlement to another.
 */
export const getPickRanking = unstable_cache(
  async (reading: PickReadingKey): Promise<PickRanking | null> => loadPickRanking(reading),
  ['picks-ranking-cache-v1'],
  { revalidate: 300 }
)
