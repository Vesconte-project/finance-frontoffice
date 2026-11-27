/**
 * Free cash flow and what it is made of, for the Fundamentals chapter (spec
 * "Definições próprias das rubricas V1", 3.2 and 3.3; ENG-216).
 *
 * Selection only. The free cash flow, the total reinvestment and each line they
 * add are values the backend publishes; nothing is added up or taken off here.
 * A line is shown with its amount only when it comes from the same filing
 * (accession) as the free cash flow, so the parts on screen are the parts of
 * that figure.
 */
import { lineItemOrigin, type ReportedPoint, type SeriesOrigin, type StatementRowLike } from './statement-reading'

type Row = StatementRowLike & { statementType?: string }

export type CashPart = { lineItemId: string; concept: string | null; value: number | null }

export type CashForOwnersYear = {
  periodEnd: string
  year: number
  value: number
  currency: string
  /** True for our filing definition (cash from operations minus total reinvestment). */
  ourDefinition: boolean
  /** The lines the free cash flow adds, in the backend's order. */
  parts: CashPart[]
  /** True when every part was found in the same filing, so its amount is shown. */
  partsFromFiling: boolean
  /** The total reinvestment of that filing and year, when published. */
  reinvestment: number | null
  /** Share-based pay of the same year, named beside the figure and never taken off. */
  shareBasedPay: number | null
}

export type CashForOwners = {
  /** Annual free cash flow with a figure, oldest first, in the latest year's currency. */
  points: ReportedPoint[]
  origin: SeriesOrigin
  latest: CashForOwnersYear | null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The newest revision of each annual period of one exact cash-flow line item, oldest first. */
function newestByPeriod(rows: readonly Row[], lineItemId: string): Row[] {
  const seen = new Set<string>()
  const newest: Row[] = []
  for (const row of rows) {
    if (row.lineItemId !== lineItemId || row.periodType !== 'annual' || !DAY.test(row.periodEnd)) continue
    if (row.statementType && row.statementType !== 'cash_flow') continue
    if (row.source === 'derived_reported_statements') continue
    if (seen.has(row.periodEnd)) continue
    seen.add(row.periodEnd)
    newest.push(row)
  }
  return newest.sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
}

const valued = (row: Row | undefined): row is Row & { value: number } =>
  Boolean(row) && row!.value !== null && Number.isFinite(row!.value)

export function cashForOwners(cashflow: readonly Row[]): CashForOwners {
  const series = newestByPeriod(cashflow, 'free_cash_flow').filter(valued)
  const currency = series.at(-1)?.currency ?? null
  const inCurrency = currency ? series.filter((row) => row.currency === currency) : []
  const points = inCurrency.map((row) => ({
    periodEnd: row.periodEnd,
    year: row.fiscalYear ?? Number(row.periodEnd.slice(0, 4)),
    value: row.value as number,
    currency: row.currency,
  }))
  const origin = lineItemOrigin(cashflow, 'free_cash_flow')
  const last = inCurrency.at(-1)
  if (!last || !currency) return { points, origin, latest: null }

  const samePeriod = (lineItemId: string) => newestByPeriod(cashflow, lineItemId).find((row) => row.periodEnd === last.periodEnd)
  const sameFiling = (row: Row | undefined) => valued(row) && Boolean(last.accession) && row.accession === last.accession
    && row.currency === currency
  const parts = (last.composition ?? []).map((part) => {
    const row = samePeriod(part.lineItemId)
    return { lineItemId: part.lineItemId, concept: part.concept, value: sameFiling(row) ? row!.value : null }
  })
  const reinvestmentRow = samePeriod('reinvestment_total')
  const pay = samePeriod('stock_based_compensation')
  return {
    points,
    origin,
    latest: {
      periodEnd: last.periodEnd,
      year: points.at(-1)!.year,
      value: last.value as number,
      currency,
      ourDefinition: Boolean(last.definitionId?.startsWith('sec_selection.')),
      parts,
      partsFromFiling: parts.length > 0 && parts.every((part) => part.value !== null),
      reinvestment: sameFiling(reinvestmentRow) ? reinvestmentRow!.value : null,
      shareBasedPay: valued(pay) && pay.currency === currency ? pay.value : null,
    },
  }
}
