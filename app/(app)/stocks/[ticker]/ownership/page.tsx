import StockOwnershipResearch from '@/components/stocks/StockOwnershipResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerEquityCapitalEvents } from '@/lib/canonical-research'
import { buybackExecutions, buybackSummary, pricePeriods, sharesBoughtBack, singleCurrency } from '@/lib/capital-reading'
import { BACKEND_HISTORY_PERIOD_DAYS_MAX, getHistoricalData } from '@/lib/finance'
import { currentResearchSnapshot } from '@/lib/research-evidence'
import { summaryDate } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'

/** The Spec's buyback chapter reads from 2016. */
const SINCE_YEAR = 2016
const SINCE = `${SINCE_YEAR}-01-01`

export default async function OwnershipPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const [data, capital, prices] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getTickerEquityCapitalEvents(ticker, { limit: 500 }).catch(() => null),
    getHistoricalData(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX).catch(() => []),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const snapshot = currentResearchSnapshot(data)
  const currency = snapshot.currency || data.currency
  const buybacks = data.kind === 'fund' || !capital?.available ? [] : buybackExecutions(capital.rows, SINCE)
  // Spending is never added across currencies; such a company's buybacks are being built.
  const oneCurrency = singleCurrency(buybacks, currency)
  const thisYear = new Date().getUTCFullYear()
  // "How the price got here" reads the last five years, by year or by quarter.
  const priceSince = `${thisYear - 4}-01-01`
  // Years add up the executions and value their shares at today's price.
  const summary = oneCurrency
    ? buybackSummary(buybacks, data.summary.quote?.price ?? null, { fromYear: SINCE_YEAR, toYear: thisYear })
    : null
  return (
    <StockOwnershipResearch
      data={data}
      buybackYears={summary}
      mixedCurrencies={!oneCurrency}
      sharesBought={sharesBoughtBack(buybacks)}
      sharesToday={snapshot.sharesOutstanding}
      sharesTodayAsOf={snapshot.sharesOutstanding === null ? null : summaryDate(data.summary.latestFundamentals, /shares.*outstanding/i)}
      priceByYear={pricePeriods(prices, 'year', priceSince)}
      priceByQuarter={pricePeriods(prices, 'quarter', priceSince)}
    />
  )
}
