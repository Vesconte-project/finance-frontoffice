import CurrencyNotice, { keptAsReported } from '@/components/stocks/CurrencyNotice'
import StockFundamentalsResearch from '@/components/stocks/StockFundamentalsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerCorporateActions, getTickerFinancialStatements } from '@/lib/canonical-research'
import { capitalHistory } from '@/lib/capital-statements'
import { annualSeries, dividendHistory } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'

export default async function FundamentalsPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ currency?: string | string[] }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: amounts in that currency, converted by the backend at each value's date (founder, 2026-11-05).
  const displayCurrency = await resolveDisplayCurrency((await searchParams).currency).catch(() => null)
  // Reported values only (Spec "Página de ticker — leitura em camadas V1",
  // founder decision 2026-10-04): annual revenue from the statements, and the
  // dividends the corporate-actions read model reports. Everything derived is
  // being built in the backend.
  const [data, income, dividends] = await Promise.all([
    getStockResearchData(ticker, displayCurrency).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500, displayCurrency }).catch(() => null),
    getTickerCorporateActions(ticker, { actionType: 'dividend', limit: 200, displayCurrency }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const [balance,cashflow] = data.kind === 'fund' ? [null,null] : await Promise.all([
    getTickerFinancialStatements(ticker, { statementType: 'balance_sheet', periodType: 'annual', limit: 500, displayCurrency }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'cash_flow', periodType: 'annual', limit: 500, displayCurrency }).catch(() => null),
  ])
  const capital=capitalHistory(balance?.available ? balance.rows : [],cashflow?.available ? cashflow.rows : [])
  const today = new Date().toISOString().slice(0, 10)
  return (
    <>
      <CurrencyNotice display={displayCurrency} listing={data.listingCurrency} summaryConverted={data.displayCurrency !== null} kept={keptAsReported([{ label: 'revenue', read: income }, { label: 'cash and debt', read: balance }, { label: 'dividends', read: dividends }])} />
    <StockFundamentalsResearch
      data={data}
      capital={capital}
      revenue={income?.available ? annualSeries(income.rows, 'revenue') : []}
      dividends={dividends?.available ? dividendHistory(dividends.rows, today) : null}
      revenueGrowth={income?.available ? annualSeries(income.rows, 'revenueGrowth') : []}
      operatingMargins={income?.available ? annualSeries(income.rows, 'operatingIncomeShare') : []}
    />
    </>
  )
}
