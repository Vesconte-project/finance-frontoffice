import DisplayCurrencyNote from '@/components/stocks/DisplayCurrencyNote'
import StockFundamentalsResearch from '@/components/stocks/StockFundamentalsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerCorporateActions, getTickerFinancialStatements } from '@/lib/canonical-research'
import { mergeReports } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { annualSeries, dividendHistory } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'

export default async function FundamentalsPage({ params, searchParams }: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ currency?: string | string[] }>
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams])
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: amounts arrive converted by the backend, each at its own date.
  const requested = await resolveDisplayCurrency(query.currency)
  // Reported values only (Spec "Página de ticker — leitura em camadas V1",
  // founder decision 2026-10-04): annual revenue from the statements, and the
  // dividends the corporate-actions read model reports. Everything derived is
  // being built in the backend.
  const [data, income, dividends] = await Promise.all([
    getStockResearchData(ticker, requested).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500, currency: requested }).catch(() => null),
    getTickerCorporateActions(ticker, { actionType: 'dividend', limit: 200, currency: requested }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const today = new Date().toISOString().slice(0, 10)
  const display = data.displayCurrency
  return (
    <>
      {display ? <DisplayCurrencyNote spaced report={mergeReports(display, [income?.displayReport, dividends?.displayReport])} /> : null}
      <StockFundamentalsResearch
        key={display ?? 'reported'}
        data={data}
        revenue={income?.available ? annualSeries(income.rows, 'revenue') : []}
        dividends={dividends?.available ? dividendHistory(dividends.rows, today) : null}
      />
    </>
  )
}
