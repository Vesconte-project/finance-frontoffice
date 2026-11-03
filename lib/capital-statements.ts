/** Exact canonical annual facts. No cash/profit reconciliation or inferred shares. */
import type { StatementRowLike, ReportedPoint } from './statement-reading'

type Row = StatementRowLike & { statementType?: string; knownAt?: string; dataQualityFlags?: unknown }
type SelectedPoint = ReportedPoint & { evidence: Row }
export type CashDebtPoint = { periodEnd: string; year: number; cash: number; debt: number; netCash: number; currency: string }
export type CapitalHistory = { cashDebt: CashDebtPoint[]; dividends: ReportedPoint[]; buybacks: ReportedPoint[]; shares: ReportedPoint[] }

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
    buybacks:annual(cashflow,'share_repurchases_amount','cash_flow',true).map(plain),shares:annual(balance,'shares_outstanding','balance_sheet').map(plain)}
}
