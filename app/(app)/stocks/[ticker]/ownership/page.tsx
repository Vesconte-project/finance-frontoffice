import CurrencyNotice, { keptAsReported } from '@/components/stocks/CurrencyNotice'
import StockOwnershipResearch from '@/components/stocks/StockOwnershipResearch'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import { getTickerEquityCapitalEvents, getTickerFinancialStatements } from '@/lib/canonical-research'
import { capitalHistory } from '@/lib/capital-statements'
import { buybackExecutions, buybackSummary, pricePeriods, sharesBoughtBack, singleCurrency } from '@/lib/capital-reading'
import { BACKEND_HISTORY_PERIOD_DAYS_MAX, getClosesIn } from '@/lib/finance'
import { currentResearchSnapshot } from '@/lib/research-evidence'
import { summaryDate } from '@/lib/statement-reading'
import { getStockResearchData } from '@/lib/stock-research'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'

/** The Spec's buyback chapter reads from 2016. */
const SINCE_YEAR = 2016
const SINCE = `${SINCE_YEAR}-01-01`

export default async function OwnershipPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ currency?: string | string[] }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  // `?currency=`: amounts in that currency, converted by the backend at each value's date (founder, 2026-11-05).
  const displayCurrency = await resolveDisplayCurrency((await searchParams).currency).catch(() => null)
  const [data, capital] = await Promise.all([
    getStockResearchData(ticker, displayCurrency).catch(() => null),
    getTickerEquityCapitalEvents(ticker, { limit: 500, displayCurrency }).catch(() => null),
  ])
  if (!data) return <ResearchUnavailable ticker={ticker} />
  // Prices follow the page: in the display currency only when the page's amounts are.
  const { points: prices } = await getClosesIn(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX, data.displayCurrency).catch(() => ({ points: [], currency: null }))
  const [balance,cashflow] = data.kind === 'fund' ? [null,null] : await Promise.all([
    getTickerFinancialStatements(ticker, { statementType: 'balance_sheet', periodType: 'annual', limit: 500, displayCurrency }).catch(() => null),
    getTickerFinancialStatements(ticker, { statementType: 'cash_flow', periodType: 'annual', limit: 500, displayCurrency }).catch(() => null),
  ])
  const annual=capitalHistory(balance?.available ? balance.rows : [],cashflow?.available ? cashflow.rows : [])
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
    <>
      <CurrencyNotice display={displayCurrency} listing={data.listingCurrency} summaryConverted={data.displayCurrency !== null} kept={keptAsReported([{ label: 'cash, debt and shares', read: balance }, { label: 'buybacks', read: capital }])} />
    <StockOwnershipResearch
      data={data}
      annual={annual}
      buybackYears={summary}
      mixedCurrencies={!oneCurrency}
      sharesBought={sharesBoughtBack(buybacks)}
      sharesToday={snapshot.sharesOutstanding}
      sharesTodayAsOf={snapshot.sharesOutstanding === null ? null : summaryDate(data.summary.latestFundamentals, /shares.*outstanding/i)}
      priceByYear={pricePeriods(prices, 'year', priceSince)}
      priceByQuarter={pricePeriods(prices, 'quarter', priceSince)}
    />
    </>
  )
}
