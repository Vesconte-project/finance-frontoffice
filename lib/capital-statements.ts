/** Exact canonical annual facts. No cash/profit reconciliation or inferred shares. */
import type { StatementRowLike, ReportedPoint } from './statement-reading'

type Row = StatementRowLike & { statementType?: string; knownAt?: string; dataQualityFlags?: unknown }
type SelectedPoint = ReportedPoint & { evidence: Row }
export type CashDebtPoint = { periodEnd: string; year: number; cash: number; debt: number; netCash: number; currency: string }
export type CapitalHistory = {
  cashDebt: CashDebtPoint[]; dividends: ReportedPoint[]; buybacks: ReportedPoint[]; shares: ReportedPoint[]
  /** Operating-lease liabilities, kept apart from debt (spec "Definições próprias das rubricas V1", 3.8). */
  leases: ReportedPoint[]
  /** When the debt falls due, as the latest filing reports it (spec 3.8). */
  maturities: DebtMaturities | null
}

/** The SEC debt maturities by year, in the order they fall due. */
export const MATURITY_BUCKETS = [
  ['debt_maturity_next_12_months', 'Within a year'],
  ['debt_maturity_year_2', 'In the second year'],
  ['debt_maturity_year_3', 'In the third year'],
  ['debt_maturity_year_4', 'In the fourth year'],
  ['debt_maturity_year_5', 'In the fifth year'],
  ['debt_maturity_after_year_5', 'After five years'],
] as const

export type DebtMaturities = {
  periodEnd: string
  year: number
  currency: string
  accession: string
  /** Only the years the filing reports, in order; a missing year is never a zero. */
  buckets: Array<{ lineItemId: string; label: string; value: number }>
}

/**
 * The debt maturities of the latest year that reports any, all from one filing
 * and in one currency. Selection only: nothing is added up.
 */
export function debtMaturities(balance: readonly Row[]): DebtMaturities | null {
  const newest = MATURITY_BUCKETS.map(([id, label]) => ({ id, label, rows: annualNewest(balance, id, 'balance_sheet') }))
  const ends = newest.flatMap(({ rows }) => rows.filter(row => row.value !== null && Number.isFinite(row.value)).map(row => row.periodEnd))
  const periodEnd = ends.sort().at(-1)
  if (!periodEnd) return null
  const found = newest.flatMap(({ id, label, rows }) => {
    const row = rows.find(candidate => candidate.periodEnd === periodEnd)
    return row && row.value !== null && Number.isFinite(row.value) && row.value >= 0 ? [{ lineItemId: id, label, row }] : []
  })
  const accession = found[0]?.row.accession
  const currency = found[0]?.row.currency
  if (!accession || !currency || found.some(({ row }) => row.accession !== accession || row.currency !== currency)) return null
  return {
    periodEnd,
    year: found[0].row.fiscalYear ?? Number(periodEnd.slice(0, 4)),
    currency,
    accession,
    buckets: found.map(({ lineItemId, label, row }) => ({ lineItemId, label, value: row.value as number })),
  }
}

/** The newest revision of each annual period of one exact line item, empty ones included. */
function annualNewest(rows: readonly Row[], id: string, statement: string): Row[] {
  const seen = new Set<string>()
  return rows.filter(row => {
    if (row.lineItemId !== id || row.periodType !== 'annual' || !/^\d{4}-\d{2}-\d{2}$/.test(row.periodEnd)) return false
    if ((row.statementType && row.statementType !== statement) || row.source === 'derived_reported_statements') return false
    if (seen.has(row.periodEnd)) return false
    seen.add(row.periodEnd)
    return true
  })
}

function annual(rows: readonly Row[], id: string, statement: string, derived = false): SelectedPoint[] {
  const seen = new Set<string>()
  const candidates = rows.filter(row => row.lineItemId === id && row.periodType === 'annual'
    && (!row.statementType || row.statementType === statement)
    && (derived ? row.source === 'derived_reported_statements' : row.source !== 'derived_reported_statements')
    && /^\d{4}-\d{2}-\d{2}$/.test(row.periodEnd)
    && Number.isFinite(Date.parse(`${row.periodEnd}T00:00:00Z`))
    && new Date(`${row.periodEnd}T00:00:00Z`).toISOString().slice(0,10)===row.periodEnd)
  // The route orders revisions newest first, including an explicit null.
  const chosen = candidates.filter(row => {
    if (seen.has(row.periodEnd)) return false
    seen.add(row.periodEnd)
    return true
  }).sort((left,right)=>left.periodEnd.localeCompare(right.periodEnd))
  const currency = chosen.at(-1)?.currency
  return chosen.filter(row => row.value !== null && Number.isFinite(row.value)
    && (!id.endsWith('_amount') || row.value >= 0)
    && (id === 'shares_outstanding' ? row.value > 0 : Boolean(currency) && row.currency === currency))
    .map(row=>({periodEnd:row.periodEnd,year:row.fiscalYear ?? Number(row.periodEnd.slice(0,4)),value:row.value as number,currency:row.currency,evidence:row}))
}

export function capitalHistory(balance: readonly Row[], cashflow: readonly Row[]): CapitalHistory {
  const cash=annual(balance,'cash_and_equivalents','balance_sheet')
  const debt=annual(balance,'total_debt','balance_sheet')
  const net=annual(balance,'net_cash','balance_sheet',true)
  const plain=(point:SelectedPoint):ReportedPoint=>({periodEnd:point.periodEnd,year:point.year,value:point.value,currency:point.currency})
  const cashDebt=net.flatMap(point=>{
    const c=cash.find(row=>row.periodEnd===point.periodEnd)
    const d=debt.find(row=>row.periodEnd===point.periodEnd)
    const flags=point.evidence.dataQualityFlags as {inputValues?:Record<string,unknown>;inputKnownAt?:Record<string,unknown>} | null
    const evidence=flags?.inputValues
    const known=flags?.inputKnownAt
    const coherent=c && d && evidence?.cash_and_equivalents===c.value && evidence?.total_debt===d.value
      && typeof c.evidence.knownAt==='string' && typeof d.evidence.knownAt==='string'
      && known?.cash_and_equivalents===c.evidence.knownAt.slice(0,10) && known?.total_debt===d.evidence.knownAt.slice(0,10)
    return coherent && c && d && point.currency && c.currency===point.currency && d.currency===point.currency && c.value>=0 && d.value>=0
      ? [{periodEnd:point.periodEnd,year:point.year,cash:c.value,debt:d.value,netCash:point.value,currency:point.currency}] : []
  })
  return {cashDebt,dividends:annual(cashflow,'dividends_paid_amount','cash_flow',true).map(plain),
    buybacks:annual(cashflow,'share_repurchases_amount','cash_flow',true).map(plain),shares:annual(balance,'shares_outstanding','balance_sheet').map(plain),
    leases:annual(balance,'operating_lease_liability','balance_sheet').filter(point=>point.value>=0).map(plain),
    maturities:debtMaturities(balance)}
}
