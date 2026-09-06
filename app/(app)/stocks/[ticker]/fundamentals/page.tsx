import StockFundamentalsResearch from '@/components/stocks/StockFundamentalsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerFinancialStatements } from '@/lib/canonical-research'
import { buildFundamentalsView } from '@/lib/stock-fundamentals-view'
import { getStockResearchData } from '@/lib/stock-research'

export default async function FundamentalsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // Annual periods, and every one the backend holds — no window. The sibling
  // Financials view asks for 500 and then slices to five in the browser, which
  // is where the "five years" on this page came from; it was ours, not the
  // contract's.
  const [data, income, balance, cashFlow] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500 }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'balance_sheet', periodType: 'annual', limit: 500 }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'cash_flow', periodType: 'annual', limit: 500 }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const view = buildFundamentalsView(data, {
    income_statement: income,
    balance_sheet: balance,
    cash_flow: cashFlow,
  })
  return <StockFundamentalsResearch data={data} view={view} />
}
