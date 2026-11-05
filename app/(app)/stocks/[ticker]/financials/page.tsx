import CurrencyNotice, { keptAsReported } from '@/components/stocks/CurrencyNotice'
import StockFinancialsResearch from '@/components/stocks/StockFinancialsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerFinancialStatements } from '@/lib/canonical-research'
import { incomeSeries, reportedYears } from '@/lib/statement-reading'
import { getStockResearchIdentity } from '@/lib/stock-research'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'

export default async function FinancialsPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ currency?: string | string[] }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: amounts in that currency, converted by the backend at each value's date (founder, 2026-11-05).
  const displayCurrency = await resolveDisplayCurrency((await searchParams).currency).catch(() => null)
  // The flow of a year's sales, from reported annual results only (Spec
  // "Página de ticker — leitura em camadas V1"). The statement tables and their
  // history by plan were removed by the founder on 2026-10-04; an old
  // `?period=` or `?statement=` link simply lands here.
  const [data, income] = await Promise.all([
    getStockResearchIdentity(ticker, displayCurrency).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500, displayCurrency }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const series = incomeSeries(income?.available ? income.rows : [])
  return (
    <>
      <CurrencyNotice display={displayCurrency} listing={data.listingCurrency} summaryConverted={data.displayCurrency !== null} kept={keptAsReported([{ label: 'the flow of sales', read: income }])} />
      <StockFinancialsResearch data={data} series={series} years={reportedYears(series, 5)} />
    </>
  )
}
