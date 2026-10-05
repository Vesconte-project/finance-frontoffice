/**
 * Reported buyback executions for Ownership & Capital.
 *
 * Each execution is what the equity-capital-events read model reports: the
 * amount spent, the shares bought and their average price for a period. The
 * yearly view adds them up and values the shares at today's price (simple
 * arithmetic, Spec decision 4); the share count then and now comes from the
 * backend (ENG-167).
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

export type BuybackYear = {
  year: number
  /** Sum of the amounts reported for the year's executions. */
  spent: number
  /** What the shares bought that year are worth at today's price; null when a share count is missing. */
  worthToday: number | null
  /** worthToday ÷ spent: what $1 spent that year is worth now. */
  multiple: number | null
}

export type BuybackSummary = {
  years: BuybackYear[]
  spent: number
  worthToday: number | null
  /** Share of all spending that fell in the last two years shown. */
  recentShare: number | null
  recentYears: number[]
}

/**
 * Buybacks by year (Spec PRD-78, "Buybacks since 2016"), from the reported
 * executions and today's price. Sums and one multiplication — the very simple
 * arithmetic the Spec's decision 4 allows. A year whose executions lack a share
 * count has no value today rather than a partial one.
 */
export function buybackSummary(executions: readonly BuybackExecution[], price: number | null): BuybackSummary | null {
  const byYear = new Map<number, BuybackExecution[]>()
  for (const execution of executions) {
    if (execution.amount === null) continue
    const year = Number(execution.date.slice(0, 4))
    const list = byYear.get(year)
    if (list) list.push(execution)
    else byYear.set(year, [execution])
  }
  if (byYear.size === 0) return null
  const usablePrice = price !== null && Number.isFinite(price) && price > 0 ? price : null
  const years = [...byYear.entries()].sort(([left], [right]) => left - right).map(([year, list]) => {
    const spent = list.reduce((total, execution) => total + (execution.amount as number), 0)
    const allShares = list.every((execution) => execution.shares !== null)
    const shares = list.reduce((total, execution) => total + (execution.shares ?? 0), 0)
    const worthToday = usablePrice !== null && allShares ? shares * usablePrice : null
    return { year, spent, worthToday, multiple: worthToday !== null && spent > 0 ? worthToday / spent : null }
  })
  const spent = years.reduce((total, year) => total + year.spent, 0)
  const worthToday = years.every((year) => year.worthToday !== null)
    ? years.reduce((total, year) => total + (year.worthToday as number), 0)
    : null
  const recentYears = years.slice(-2).map((year) => year.year)
  const recentSpent = years.slice(-2).reduce((total, year) => total + year.spent, 0)
  return {
    years,
    spent,
    worthToday,
    recentShare: years.length > 2 && spent > 0 ? recentSpent / spent : null,
    recentYears,
  }
}
