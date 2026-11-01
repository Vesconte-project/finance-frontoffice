import 'server-only'

import type { EarningsHistoryRow } from './ticker-data'

export type SafeEarningsObservation = {
  earningsDate: string
  fiscalPeriod: string | null
  epsActual: number | null
  epsEstimate: number | null
  epsSurprisePct: number | null
  revenueActual: number | null
  revenueEstimate: number | null
  revenueSurprisePct: number | null
}

export type EarningsHistoryNormalization = {
  rows: SafeEarningsObservation[]
  duplicateKeys: string[]
  rawRows: number
}

function finiteNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeEarningsHistory(rows: EarningsHistoryRow[]): EarningsHistoryNormalization {
  const duplicateKeys = new Set<string>()
  const seen = new Set<string>()
  const normalized = rows.flatMap((row) => {
    if (!row.earningsDate || Number.isNaN(Date.parse(row.earningsDate))) return []
    const key = `${row.earningsDate.slice(0, 10)}|${row.fiscalPeriod ?? ''}`
    // A repeated date and period means we cannot tell which row is
    // authoritative for that quarter, so that quarter is dropped. It used to
    // discard the entire history instead: one conflicting quarter and eleven
    // clean ones disappeared together, which is why nobody ever saw this.
    if (seen.has(key)) {
      duplicateKeys.add(key)
      return []
    }
    seen.add(key)
    return [{
      earningsDate: row.earningsDate,
      fiscalPeriod: row.fiscalPeriod,
      epsActual: finiteNumber(row.epsActual),
      epsEstimate: finiteNumber(row.epsEstimate),
      epsSurprisePct: finiteNumber(row.epsSurprisePct),
      revenueActual: finiteNumber(row.revenueActual),
      revenueEstimate: finiteNumber(row.revenueEstimate),
      revenueSurprisePct: finiteNumber(row.revenueSurprisePct),
    }]
  })

  normalized.sort((left, right) => Date.parse(right.earningsDate) - Date.parse(left.earningsDate))

  return {
    rows: normalized.filter((row) => !duplicateKeys.has(`${row.earningsDate.slice(0, 10)}|${row.fiscalPeriod ?? ''}`)),
    duplicateKeys: [...duplicateKeys],
    rawRows: rows.length,
  }
}

/** The selected earnings date belongs to the summary, not the generic calendar. */
export function selectNextResearchEvent<T extends { row: { domain: string; occursAt: string | null } }>(
  isFund: boolean,
  earningsDate: string | null,
  upcoming: readonly T[],
): { entry: T | null; date: string | null } {
  if (isFund) {
    const entry = upcoming[0] ?? null
    return { entry, date: entry?.row.occursAt ?? null }
  }
  const entry = earningsDate ? upcoming.find((candidate) => (
    candidate.row.domain === 'earningsEvents'
    && candidate.row.occursAt?.slice(0, 10) === earningsDate.slice(0, 10)
  )) ?? null : null
  return { entry, date: earningsDate }
}
