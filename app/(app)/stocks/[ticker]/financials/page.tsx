import StockFinancialsResearch from '@/components/stocks/StockFinancialsResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerFinancialStatements } from '@/lib/canonical-research'
import { incomeSeries, reportedYears } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'

export default async function FinancialsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // The flow of a year's sales, from reported annual results only (Spec
  // "Página de ticker — leitura em camadas V1"). The statement tables and their
  // history by plan were removed by the founder on 2026-10-04; an old
  // `?period=` or `?statement=` link simply lands here.
  const [data, income] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'income_statement', periodType: 'annual', limit: 500 }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const series = incomeSeries(income?.available ? income.rows : [])
  return <StockFinancialsResearch data={data} series={series} years={reportedYears(series, 5)} />
}
