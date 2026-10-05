/**
 * Reported buyback executions for Ownership & Capital.
 *
 * Each execution is what the equity-capital-events read model reports: the
 * amount spent, the shares bought and their average price for a period. Totals
 * per year, what those shares are worth today and the share count then and now
 * are not summed or multiplied here; they come from the backend (ENG-167).
 *
 * The event vocabulary is not documented yet (its production coverage is
 * ENG-156), so a buyback is recognised by its type, family, subtype or program
 * naming a repurchase, and must carry an executed amount or share count.
 */

export type CapitalEventLike = {
  eventId: string | null
  eventFamily: string | null
  eventType: string | null
  eventSubtype: string | null
  programName: string | null
  announcementDate: string | null
  filingDate: string | null
  effectiveDate: string | null
  periodStart: string | null
  periodEnd: string | null
  amountExecuted: number | null
  shareCountExecuted: number | null
  averagePrice: number | null
  currency: string | null
}

export type BuybackExecution = {
  id: string
  /** The day the execution is placed on: its period end, else its effective, filing or announcement date. */
  date: string
  periodStart: string | null
  amount: number | null
  shares: number | null
  averagePrice: number | null
  currency: string | null
}

const BUYBACK = /repurchase|buy[\s_-]?back/i
const DAY = /^\d{4}-\d{2}-\d{2}/

function finite(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null
}

/** Reported buyback executions since `since` (YYYY-MM-DD), oldest first, one per event. */
export function buybackExecutions(rows: readonly CapitalEventLike[], since: string): BuybackExecution[] {
  const byId = new Map<string, BuybackExecution>()
  for (const row of rows) {
    const naming = [row.eventType, row.eventFamily, row.eventSubtype, row.programName].filter(Boolean).join(' ')
    if (!BUYBACK.test(naming)) continue
    const amount = finite(row.amountExecuted)
    const shares = finite(row.shareCountExecuted)
    if (amount === null && shares === null) continue
    const when = [row.periodEnd, row.effectiveDate, row.filingDate, row.announcementDate].find((value) => value && DAY.test(value))
    if (!when) continue
    const date = when.slice(0, 10)
    if (date < since) continue
    const id = row.eventId ?? `${date}:${amount ?? ''}:${shares ?? ''}`
    if (byId.has(id)) continue
    byId.set(id, {
      id,
      date,
      periodStart: row.periodStart && DAY.test(row.periodStart) ? row.periodStart.slice(0, 10) : null,
      amount,
      shares,
      averagePrice: finite(row.averagePrice),
      currency: row.currency,
    })
  }
  return [...byId.values()].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
}
