/**
 * Reported statement values for the Fundamentals and Financials tabs.
 *
 * Everything here selects and orders what the backend reports; nothing is
 * computed from it. Growth, period-over-period changes, ratios and differences
 * between line items (a cost of sales taken as revenue minus gross profit) are
 * owned by the backend (ENG-90, ENG-170) and appear as "Being built" until it
 * sends them. The founder's rule for these tabs, 2026-10-04: only reported
 * values.
 */

export type StatementRowLike = {
  lineItemId: string
  displayLabel: string | null
  value: number | null
  currency: string | null
  periodType: string
  fiscalYear: number | null
  periodEnd: string
}

export type ReportedPoint = {
  periodEnd: string
  /** Fiscal year when the backend states it, else the calendar year of the period end. */
  year: number
  value: number
  currency: string | null
}

export type MeasureKey = 'revenue' | 'grossProfit' | 'operatingIncome' | 'netIncome'

type MeasureMatcher = {
  /** Exact `lineItemId` spellings, tried first (the vocabulary is undocumented, ENG-87). */
  prefer: RegExp
  /** Tolerant fallback over the id and the display label together. */
  accept: RegExp
  reject: RegExp
}

const MEASURES: Record<MeasureKey, MeasureMatcher> = {
  revenue: {
    prefer: /^(total_revenue|revenue|revenues|net_sales|total_net_sales|net_revenue|operating_revenue)$/,
    accept: /revenue|net sales/i,
    reject: /cost|expense|growth|per share|segment|deferred/i,
  },
  grossProfit: {
    prefer: /^(gross_profit|gross_income)$/,
    accept: /gross (profit|income)/i,
    reject: /margin|per share/i,
  },
  operatingIncome: {
    prefer: /^(operating_income|operating_income_loss|total_operating_income_as_reported)$/,
    accept: /operating (income|profit)/i,
    reject: /margin|per share|non.?operating/i,
  },
  netIncome: {
    prefer: /^(net_income|net_income_common_stockholders|net_income_continuous_operations|profit_loss)$/,
    accept: /net income/i,
    reject: /per share|margin|discontinued|minority|noncontrolling|extraordinary/i,
  },
}

function yearOf(row: StatementRowLike): number {
  return row.fiscalYear ?? Number(row.periodEnd.slice(0, 4))
}

/**
 * One reported value per annual period for a measure, oldest first. When the
 * same period arrives twice the first row wins: the backend orders revisions
 * newest first.
 */
export function annualSeries(rows: readonly StatementRowLike[], measure: MeasureKey): ReportedPoint[] {
  const matcher = MEASURES[measure]
  const annual = rows.filter((row) => row.periodType === 'annual' && /^\d{4}-\d{2}-\d{2}/.test(row.periodEnd))
  const byId = new Map<string, StatementRowLike[]>()
  for (const row of annual) {
    const list = byId.get(row.lineItemId)
    if (list) list.push(row)
    else byId.set(row.lineItemId, [row])
  }
  const entries = [...byId.entries()]
  const exact = entries.filter(([id]) => matcher.prefer.test(id.toLowerCase()))
  const candidates = exact.length > 0
    ? exact
    : entries.filter(([id, list]) => {
      const subject = `${id} ${list[0].displayLabel ?? ''}`
      return matcher.accept.test(subject) && !matcher.reject.test(subject)
    })
  if (candidates.length === 0) return []
  // The most complete series is the one to chart; the shortest id breaks a tie
  // towards the headline item rather than a qualified variant of it.
  const [, chosen] = candidates.sort((left, right) => right[1].length - left[1].length || left[0].length - right[0].length)[0]

  const byPeriod = new Map<string, ReportedPoint>()
  for (const row of chosen) {
    if (row.value === null || !Number.isFinite(row.value) || byPeriod.has(row.periodEnd)) continue
    byPeriod.set(row.periodEnd, { periodEnd: row.periodEnd, year: yearOf(row), value: row.value, currency: row.currency })
  }
  return [...byPeriod.values()].sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
}

export type IncomeSeries = Record<MeasureKey, ReportedPoint[]>

export function incomeSeries(rows: readonly StatementRowLike[]): IncomeSeries {
  return {
    revenue: annualSeries(rows, 'revenue'),
    grossProfit: annualSeries(rows, 'grossProfit'),
    operatingIncome: annualSeries(rows, 'operatingIncome'),
    netIncome: annualSeries(rows, 'netIncome'),
  }
}

/** The fiscal years any income measure reports, newest first, at most `limit`. */
export function reportedYears(series: IncomeSeries, limit = 5): number[] {
  const years = new Set<number>()
  for (const points of Object.values(series)) for (const point of points) years.add(point.year)
  return [...years].sort((left, right) => right - left).slice(0, limit)
}

export function valueInYear(points: readonly ReportedPoint[], year: number): ReportedPoint | null {
  return points.find((point) => point.year === year) ?? null
}

/** Compact year for narrow charts: 2025 → '25. */
export function shortYear(year: number): string {
  return `'${String(year).slice(-2)}`
}

export type CorporateActionLike = {
  actionType: string | null
  exDate: string | null
  cashAmount: number | null
  adjustedCashAmount: number | null
  currency: string | null
}

export type DividendPayment = {
  exDate: string
  amount: number
  currency: string | null
}

export type DividendHistory = {
  payments: DividendPayment[]
  /** True when the amounts are the source's split-adjusted ones. */
  adjusted: boolean
}

/**
 * Reported dividends per share over the last `years`, oldest first, by ex-date.
 *
 * Amounts are never mixed: the source's split-adjusted amount is used when it
 * reports one for every payment in the window, otherwise the amount as paid. A
 * window spanning a split then reads as paid, which is what was reported.
 */
export function dividendHistory(
  rows: readonly CorporateActionLike[],
  today: string,
  years = 10,
): DividendHistory {
  const start = `${Number(today.slice(0, 4)) - years}${today.slice(4, 10)}`
  const byDate = new Map<string, CorporateActionLike>()
  for (const row of rows) {
    if (row.actionType !== 'dividend' || !row.exDate) continue
    const exDate = row.exDate.slice(0, 10)
    if (exDate > today || exDate <= start || byDate.has(exDate)) continue
    byDate.set(exDate, row)
  }
  const window = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right))
  const usable = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0
  const adjusted = window.length > 0 && window.every(([, row]) => usable(row.adjustedCashAmount))
  const payments = window.flatMap(([exDate, row]) => {
    const amount = adjusted ? row.adjustedCashAmount : row.cashAmount
    return usable(amount) ? [{ exDate, amount, currency: row.currency }] : []
  })
  return { payments, adjusted }
}

/**
 * A latest-fundamentals figure from the ticker summary, the same source the
 * Overview reads, so a fact has one value across the tabs. Ratios arrive as
 * fractions or as percentages; the Overview's convention (≤ 1.5 is a fraction)
 * is kept so both pages print the same number.
 */
export function summaryPercent(
  rows: ReadonlyArray<{ metric: string; metricLabel: string; valueNumber: number | null }>,
  pattern: RegExp,
): number | null {
  const row = rows.find((candidate) => pattern.test(candidate.metricLabel || candidate.metric.replace(/_/g, ' ')))
  const value = row?.valueNumber
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.abs(value) <= 1.5 ? value * 100 : value
}

export function summaryAmount(
  rows: ReadonlyArray<{ metric: string; metricLabel: string; valueNumber: number | null }>,
  pattern: RegExp,
): number | null {
  const row = rows.find((candidate) => pattern.test(candidate.metricLabel || candidate.metric.replace(/_/g, ' ')))
  const value = row?.valueNumber
  return value === null || value === undefined || !Number.isFinite(value) ? null : value
}

/**
 * The date a summary figure refers to (its period end, else when it was
 * observed), so each block can show the date of its own data (Spec: "Dados
 * desatualizados").
 */
export function summaryDate(
  rows: ReadonlyArray<{ metric: string; metricLabel: string; periodEnd?: string | null; asOf?: string | null }>,
  pattern: RegExp,
): string | null {
  const row = rows.find((candidate) => pattern.test(candidate.metricLabel || candidate.metric.replace(/_/g, ' ')))
  const date = row?.periodEnd ?? row?.asOf ?? null
  return date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null
}
