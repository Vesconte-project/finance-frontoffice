import StockFinancialStatementsResearch, {
  type StatementBundle,
  type StatementPeriod,
} from '@/components/stocks/StockFinancialStatementsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerFinancialStatements } from '@/lib/canonical-research'
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
  const [data, income, balance, cashFlow] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: period, limit: 500 }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'balance_sheet', periodType: period, limit: 500 }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'cash_flow', periodType: period, limit: 500 }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const statements: StatementBundle = {
    income,
    'balance-sheet': balance,
    'cash-flow': cashFlow,
  }
  return <StockFinancialStatementsResearch data={data} period={period} statements={statements} />
}
