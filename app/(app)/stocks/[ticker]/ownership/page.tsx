import DisplayCurrencyNote from '@/components/stocks/DisplayCurrencyNote'
import StockOwnershipResearch from '@/components/stocks/StockOwnershipResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerEquityCapitalEvents } from '@/lib/canonical-research'
import { buybackExecutions, buybackSummary, pricePeriods, sharesBoughtBack, singleCurrency } from '@/lib/capital-reading'
import { mergeReports, moneyEntryOf } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { BACKEND_HISTORY_PERIOD_DAYS_MAX, getHistoricalPrices } from '@/lib/finance'
import { currentResearchSnapshot } from '@/lib/research-evidence'
import { summaryDate } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'

/** The Spec's buyback chapter reads from 2016. */
const SINCE_YEAR = 2016
const SINCE = `${SINCE_YEAR}-01-01`
const BUYBACK = /repurchase|buy[\s_-]?back/i

export default async function OwnershipPage({ params, searchParams }: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ currency?: string | string[] }>
}) {
  const [{ ticker: rawTicker }, query] = await Promise.all([params, searchParams])
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: amounts and prices arrive converted by the backend, each at its own date.
  const requested = await resolveDisplayCurrency(query.currency)
  const [data, capital, history] = await Promise.all([
    getStockResearchData(ticker, requested).catch(() => null),
    getTickerEquityCapitalEvents(ticker, { limit: 500, currency: requested }).catch(() => null),
    getHistoricalPrices(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX, requested).catch(() => ({ points: [], report: null })),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  const display = data.displayCurrency
  const prices = history.points
  const snapshot = currentResearchSnapshot(data)
  const currency = snapshot.currency || data.currency
  const rows = data.kind === 'fund' || !capital?.available ? [] : capital.rows
  // A buyback the backend could not convert is never left out of a total in silence.
  const unconvertedBuybacks = Boolean(display) && rows.some((row) => {
    if (!BUYBACK.test([row.eventType, row.eventFamily, row.eventSubtype, row.programName].filter(Boolean).join(' '))) return false
    const entry = moneyEntryOf(row, 'amountExecuted')
    return Boolean(entry && entry.value !== null && entry.converted?.currency !== display)
  })
  const buybacks = buybackExecutions(rows, SINCE)
  // Spending is never added across currencies; such a company's buybacks are being built.
  const oneCurrency = singleCurrency(buybacks, currency)
  const thisYear = new Date().getUTCFullYear()
  // "How the price got here" reads the last five years, by year or by quarter.
  const priceSince = `${thisYear - 4}-01-01`
  // Years add up the executions and value their shares at today's price.
  const summary = oneCurrency && !unconvertedBuybacks
    ? buybackSummary(buybacks, data.summary.quote?.price ?? null, { fromYear: SINCE_YEAR, toYear: thisYear })
    : null
  return (
    <>
      {display ? <DisplayCurrencyNote spaced report={mergeReports(display, [capital?.displayReport, history.report])} /> : null}
      <StockOwnershipResearch
        key={display ?? 'reported'}
        data={data}
        buybackYears={summary}
        mixedCurrencies={!oneCurrency}
        unconvertedIn={unconvertedBuybacks ? display : null}
        sharesBought={sharesBoughtBack(buybacks)}
        sharesToday={snapshot.sharesOutstanding}
        sharesTodayAsOf={snapshot.sharesOutstanding === null ? null : summaryDate(data.summary.latestFundamentals, /shares.*outstanding/i)}
        priceByYear={pricePeriods(prices, 'year', priceSince)}
        priceByQuarter={pricePeriods(prices, 'quarter', priceSince)}
      />
    </>
  )
}
