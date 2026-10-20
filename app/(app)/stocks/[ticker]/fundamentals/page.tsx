import StockFundamentalsResearch from '@/components/stocks/StockFundamentalsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerCorporateActions, getTickerFinancialStatements } from '@/lib/canonical-research'
import { annualSeries, dividendHistory } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'

export default async function FundamentalsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // Reported values only (Spec "Página de ticker — leitura em camadas V1",
  // founder decision 2026-10-04): annual revenue from the statements, and the
  // dividends the corporate-actions read model reports. Everything derived is
  // being built in the backend.
  const [data, income, dividends] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500 }).catch(() => null),
    getTickerCorporateActions(ticker, { actionType: 'dividend', limit: 200 }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const today = new Date().toISOString().slice(0, 10)
  return (
    <StockFundamentalsResearch
      data={data}
      revenue={income?.available ? annualSeries(income.rows, 'revenue') : []}
      dividends={dividends?.available ? dividendHistory(dividends.rows, today) : null}
    />
  )
}
