/**
 * Synthetic ticker-page fixtures for browser QA.
 *
 * These symbols do not exist on any exchange and every value is invented. They
 * exist so layout checks can exercise the ticker hero with names of very
 * different lengths: the hero must adapt to whatever name the registry
 * supplies, from a few letters to a long legal name.
 */

const FIXTURE_TICKERS = {
  QAS: { name: 'Qa Short Inc.', price: 341.07, change: 2.41, changePercent: 0.71, marketCapText: '$4.98T' },
  QAM: { name: 'Quality Assurance Micro Devices, Inc.', price: 630.63, change: -4.12, changePercent: -0.65, marketCapText: '$1.03T' },
  QAL: {
    name: 'Quality Assurance Northern Atlantic Semiconductor Manufacturing Company Limited',
    price: 1284.5,
    change: 12.3,
    changePercent: 0.97,
    marketCapText: '$812.4B',
    // The longest exchange label the site renders.
    exchange: 'NYQ',
  },
}

const LAST_DATE = Date.UTC(2026, 8, 30)
const DAY_MS = 24 * 60 * 60 * 1000

export function isFixtureTicker(ticker) {
  return Object.hasOwn(FIXTURE_TICKERS, ticker)
}

/** Deterministic weekday closes ending at the fixture's quoted price. */
function closes(ticker, periodDays) {
  const { price } = FIXTURE_TICKERS[ticker]
  const days = Math.max(30, Math.min(Number(periodDays) || 365, 3650))
  const rows = []
  for (let offset = days; offset >= 0; offset -= 1) {
    const time = LAST_DATE - offset * DAY_MS
    const weekday = new Date(time).getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    const wave = Math.sin(offset / 9) * 0.04 + Math.sin(offset / 37) * 0.07
    const drift = offset / days * 0.18
    rows.push({ date: new Date(time).toISOString().slice(0, 10), close: Number((price * (1 + wave - drift)).toFixed(2)) })
  }
  rows[rows.length - 1].close = price
  return rows
}

export function tickerHistoryFixture(ticker, periodDays) {
  return closes(ticker, periodDays)
}

export function tickerOhlcFixture(ticker, periodDays) {
  return closes(ticker, periodDays).map(({ date, close }) => ({
    date,
    open: close,
    high: Number((close * 1.01).toFixed(2)),
    low: Number((close * 0.99).toFixed(2)),
    close,
    volume: 1_000_000,
  }))
}

export function tickerSummaryFixture(ticker) {
  const fixture = FIXTURE_TICKERS[ticker]
  const asOf = new Date(LAST_DATE).toISOString()
  const asOfDate = asOf.slice(0, 10)
  return {
    ticker,
    asset: { assetType: 'equity', currency: 'USD', exchange: fixture.exchange ?? 'NASDAQ', exchangeMic: null, region: 'US' },
    quote: {
      ticker,
      name: fixture.name,
      price: fixture.price,
      change: fixture.change,
      changePercent: fixture.changePercent,
      marketCapText: fixture.marketCapText,
      asOf,
    },
    marketStats: null,
    coverage: {
      ticker,
      hasMarketData: true,
      hasPrices: true,
      priceRows: 2500,
      technicalRows: null,
      firstPriceDate: '2016-09-30',
      lastPriceDate: asOfDate,
      hasTechnicals: false,
      hasFundamentals: false,
      hasEarnings: true,
      hasSignals: false,
      hasScorecard: false,
      marketDataLastDate: asOfDate,
      fundamentalsLastDate: null,
      nextEarningsDate: '2026-11-03',
      source: 'coverage_table',
      updatedAt: asOf,
    },
    fundamentalsSummary: null,
    latestFundamentals: [],
    nextEarnings: {
      ticker,
      earningsDate: '2026-11-03',
      earningsTime: null,
      epsEstimate: null,
      revenueEstimate: null,
      fiscalPeriod: null,
      asOf,
    },
    earningsHistory: [],
    componentMissingInputs: [],
  }
}
