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
  /** Sum of the amounts reported for the year's executions; null when none was reported that year. */
  spent: number | null
  /** What the shares bought that year are worth at today's price; null when a share count is missing. */
  worthToday: number | null
  /** worthToday ÷ spent: what $1 spent that year is worth now. */
  multiple: number | null
}

export type BuybackSummary = {
  /** Every year of the range, oldest first; a year with nothing reported keeps its place, empty. */
  years: BuybackYear[]
  spent: number
  worthToday: number | null
  /** Share of all spending that fell in the last two years of the range. */
  recentShare: number | null
  recentYears: number[]
}

/** True when every execution that names a currency names `currency` (no sum across currencies). */
export function singleCurrency(executions: readonly BuybackExecution[], currency: string): boolean {
  return executions.every((execution) => !execution.currency || execution.currency.toUpperCase() === currency.toUpperCase())
}

/**
 * Buybacks by year (Spec PRD-78, "Buybacks since 2016"), from the reported
 * executions and today's price, for every year from `fromYear` to `toYear`.
 * Sums and one multiplication — the very simple arithmetic the Spec's decision
 * 4 allows. A year whose executions lack a share count has no value today
 * rather than a partial one; a year with no reported execution stays empty,
 * never a zero.
 */
export function buybackSummary(
  executions: readonly BuybackExecution[],
  price: number | null,
  range: { fromYear: number; toYear: number },
): BuybackSummary | null {
  const byYear = new Map<number, BuybackExecution[]>()
  for (const execution of executions) {
    if (execution.amount === null) continue
    const year = Number(execution.date.slice(0, 4))
    if (year < range.fromYear || year > range.toYear) continue
    const list = byYear.get(year)
    if (list) list.push(execution)
    else byYear.set(year, [execution])
  }
  if (byYear.size === 0) return null
  const usablePrice = price !== null && Number.isFinite(price) && price > 0 ? price : null
  const years: BuybackYear[] = []
  for (let year = range.fromYear; year <= range.toYear; year += 1) {
    const list = byYear.get(year)
    if (!list) {
      years.push({ year, spent: null, worthToday: null, multiple: null })
      continue
    }
    const spent = list.reduce((total, execution) => total + (execution.amount as number), 0)
    const allShares = list.every((execution) => execution.shares !== null)
    const shares = list.reduce((total, execution) => total + (execution.shares ?? 0), 0)
    const worthToday = usablePrice !== null && allShares ? shares * usablePrice : null
    years.push({ year, spent, worthToday, multiple: worthToday !== null && spent > 0 ? worthToday / spent : null })
  }
  const reported = years.filter((year) => year.spent !== null)
  const spent = reported.reduce((total, year) => total + (year.spent as number), 0)
  const worthToday = reported.every((year) => year.worthToday !== null)
    ? reported.reduce((total, year) => total + (year.worthToday as number), 0)
    : null
  const recent = years.slice(-2)
  const recentSpent = recent.reduce((total, year) => total + (year.spent ?? 0), 0)
  return {
    years,
    spent,
    worthToday,
    recentShare: years.length > 2 && spent > 0 ? recentSpent / spent : null,
    recentYears: recent.map((year) => year.year),
  }
}

/**
 * Shares bought back across the executions, a sum of reported share counts.
 * Null when any execution lacks its count, rather than a partial total.
 */
export function sharesBoughtBack(executions: readonly BuybackExecution[]): number | null {
  if (executions.length === 0 || executions.some((execution) => execution.shares === null)) return null
  return executions.reduce((total, execution) => total + (execution.shares as number), 0)
}

export type PricePeriod = {
  key: string
  /** "2024" or "Q3 2024". */
  label: string
  /** Compact axis name: '24 or Q3 '24. */
  short: string
  /** First and last trading days of the period in the loaded prices. */
  startDate: string
  endDate: string
  /** The close before the period (the previous period's last close), else its first close. */
  startClose: number
  /** The period's last close. */
  endClose: number
}

/**
 * The share price by year or by quarter since a date: each period's last
 * close, and the close it started from. Reported closes only; nothing is
 * derived beyond picking them.
 */
export function pricePeriods(
  points: ReadonlyArray<{ date: string; close: number }>,
  period: 'year' | 'quarter',
  since: string,
): PricePeriod[] {
  const sorted = points
    .filter((point) => DAY.test(point.date) && Number.isFinite(point.close) && point.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
  const periods: PricePeriod[] = []
  let previousClose: number | null = null
  let current: { key: string; label: string; short: string; startDate: string; endDate: string; startClose: number; endClose: number } | null = null
  for (const point of sorted) {
    const year = point.date.slice(0, 4)
    const quarter = Math.floor((Number(point.date.slice(5, 7)) - 1) / 3) + 1
    const key = period === 'year' ? year : `${year}-Q${quarter}`
    if (point.date < since) {
      previousClose = point.close
      continue
    }
    if (!current || current.key !== key) {
      if (current) {
        periods.push(current)
        previousClose = current.endClose
      }
      current = {
        key,
        label: period === 'year' ? year : `Q${quarter} ${year}`,
        short: period === 'year' ? `'${year.slice(-2)}` : `Q${quarter} '${year.slice(-2)}`,
        startDate: point.date.slice(0, 10),
        endDate: point.date.slice(0, 10),
        startClose: previousClose ?? point.close,
        endClose: point.close,
      }
      continue
    }
    current.endDate = point.date.slice(0, 10)
    current.endClose = point.close
  }
  if (current) periods.push(current)
  return periods
}
