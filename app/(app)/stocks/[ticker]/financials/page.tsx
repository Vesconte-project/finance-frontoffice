import DisplayCurrencyNote from '@/components/stocks/DisplayCurrencyNote'
import StockFinancialsResearch from '@/components/stocks/StockFinancialsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerFinancialStatements } from '@/lib/canonical-research'
import { mergeReports } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { incomeSeries, reportedYears } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'

export default async function FinancialsPage({ params, searchParams }: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ currency?: string | string[] }>
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams])
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: each year's amounts arrive converted by the backend at the year's period end.
  const requested = await resolveDisplayCurrency(query.currency)
  // The flow of a year's sales, from reported annual results only (Spec
  // "Página de ticker — leitura em camadas V1"). The statement tables and their
  // history by plan were removed by the founder on 2026-10-04; an old
  // `?period=` or `?statement=` link simply lands here.
  const [data, income] = await Promise.all([
    getStockResearchData(ticker, requested).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500, currency: requested }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const series = incomeSeries(income?.available ? income.rows : [])
  const display = data.displayCurrency
  return (
    <>
      {display ? <DisplayCurrencyNote spaced report={mergeReports(display, [income?.displayReport])} /> : null}
      <StockFinancialsResearch key={display ?? 'reported'} data={data} series={series} years={reportedYears(series, 5)} />
    </>
  )
}
