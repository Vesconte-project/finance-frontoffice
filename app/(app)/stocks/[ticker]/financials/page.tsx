import StockFinancialStatementsResearch, {
  type StatementPeriod,
} from '@/components/stocks/StockFinancialStatementsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getViewerAccess } from '@/lib/billing'
import { getTickerFinancialStatements } from '@/lib/canonical-research'
import { tierFor } from '@/lib/picks-access-rules'
import { cutStatementHistory } from '@/lib/statement-history'
import { getStockResearchData } from '@/lib/stock-research'

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parsePeriod(value: string | undefined): StatementPeriod {
  return value === 'quarterly' ? 'quarterly' : 'annual'
}

export default async function FinancialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ period?: string | string[] }>
}) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const period = parsePeriod(singleParam((await searchParams).period))
  // All three statements, on one page. The old `?statement=` tab is gone; the
  // parameter is simply ignored if an old link still carries it.
  const [viewer, data, income, balance, cashFlow] = await Promise.all([
    getViewerAccess(),
    getStockResearchData(ticker).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: period, limit: 500 }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'balance_sheet', periodType: period, limit: 500 }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'cash_flow', periodType: period, limit: 500 }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  // History by plan (Spec "Financial statements history by plan V1"). The tier is
  // read from this request's session, which also keeps the page rendered per
  // request, and periods beyond it are dropped here — before anything renders —
  // so only their count ever reaches the browser.
  const tier = tierFor(viewer)
  const { statements, withheldBy } = cutStatementHistory(
    { income, 'balance-sheet': balance, 'cash-flow': cashFlow },
    tier,
    period,
  )
  return (
    <StockFinancialStatementsResearch
      data={data}
      period={period}
      statements={statements}
      tier={tier}
      withheldBy={withheldBy}
    />
  )
}
