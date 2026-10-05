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
    latestFundamentals: tickerLatestFundamentalsFixture(ticker),
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

/**
 * Company events for the expanded chart's Events layer. Invented, deterministic,
 * and only for QAS: quarterly results and dividends over three years, two events
 * a day apart (they must stack), and a results date that was revised (the later
 * revision must win). QAM and QAL report no events.
 */
export function tickerEventsFixture(ticker) {
  const rows = []
  if (ticker === 'QAS') {
    const day = (offset) => new Date(LAST_DATE - offset * DAY_MS).toISOString().slice(0, 10)
    for (let quarter = 0; quarter < 12; quarter += 1) {
      const offset = 68 + quarter * 91
      rows.push({
        domain: 'earningsEvents', eventId: `qas-earnings-${quarter}`, symbol: 'QAS', eventType: 'earnings',
        title: `QAS quarterly results (fixture ${12 - quarter})`, classification: 'scheduled',
        occursAt: day(offset), occursAtRole: 'event_date', knownAt: `${day(offset + 30)}T00:00:00Z`,
        source: 'fixture', primarySource: 'fixture', sourceMetadata: null, dataQualityFlags: null, confidence: null,
      })
      rows.push({
        domain: 'corporateActions', eventId: `qas-dividend-${quarter}`, symbol: 'QAS', eventType: 'cash_dividend',
        title: 'QAS quarterly dividend (fixture)', classification: 'declared',
        occursAt: day(offset + 1), occursAtRole: 'ex_date', knownAt: `${day(offset + 20)}T00:00:00Z`,
        source: 'fixture', primarySource: 'fixture', sourceMetadata: null, dataQualityFlags: null, confidence: null,
      })
    }
    // An earlier, superseded date for the latest results.
    rows.push({
      domain: 'earningsEvents', eventId: 'qas-earnings-0', symbol: 'QAS', eventType: 'earnings',
      title: 'QAS quarterly results (fixture 12)', classification: 'scheduled',
      occursAt: day(75), occursAtRole: 'event_date', knownAt: `${day(120)}T00:00:00Z`,
      source: 'fixture', primarySource: 'fixture', sourceMetadata: null, dataQualityFlags: null, confidence: null,
    })
    rows.push({
      domain: 'investorEvents', eventId: 'qas-meeting', symbol: 'QAS', eventType: 'shareholder_meeting',
      title: 'QAS annual shareholder meeting (fixture)', classification: 'scheduled',
      occursAt: day(150), occursAtRole: 'event_date', knownAt: `${day(200)}T00:00:00Z`,
      source: 'fixture', primarySource: 'fixture', sourceMetadata: null, dataQualityFlags: null, confidence: null,
    })
  }
  return {
    available: true, reason: null, symbol: ticker, count: rows.length,
    snapshotMode: 'latest', isPointInTime: false, startDate: null, endDate: null, unavailableDomains: [], rows,
  }
}

/**
 * Annual income statements for the Fundamentals and Financials tabs. Invented.
 * QAS reports ten clean years; QAM reports four, with a loss in 2024 and no
 * gross profit for 2023 (the flow must keep a thin line and say what is
 * missing); QAL reports none.
 */
const STATEMENT_FIXTURES = {
  QAS: Array.from({ length: 10 }, (_, index) => {
    const year = 2016 + index
    const revenue = 180e9 * 1.09 ** index
    return { year, revenue, gross_profit: revenue * 0.44, operating_income: revenue * 0.3, net_income: revenue * 0.24 }
  }),
  QAM: [
    { year: 2022, revenue: 42e9, gross_profit: 21e9, operating_income: 6.1e9, net_income: 4.4e9 },
    { year: 2023, revenue: 45e9, gross_profit: null, operating_income: 3.2e9, net_income: 1.9e9 },
    { year: 2024, revenue: 39e9, gross_profit: 15e9, operating_income: -2.4e9, net_income: -3.1e9 },
    { year: 2025, revenue: 47e9, gross_profit: 22e9, operating_income: 5.3e9, net_income: 3.8e9 },
  ],
  QAL: [],
}

const LINE_LABELS = {
  revenue: 'Total Revenue',
  gross_profit: 'Gross Profit',
  operating_income: 'Operating Income',
  net_income: 'Net Income',
}

export function tickerFinancialStatementsFixture(ticker, statementType) {
  const years = STATEMENT_FIXTURES[ticker] ?? []
  const rows = statementType && statementType !== 'income_statement'
    ? []
    : [...years].reverse().flatMap((entry) => Object.keys(LINE_LABELS).flatMap((lineItemId) => (
      entry[lineItemId] === null ? [] : [{
        symbol: ticker,
        statementType: 'income_statement',
        lineItemId,
        displayLabel: LINE_LABELS[lineItemId],
        value: entry[lineItemId],
        currency: 'USD',
        periodType: 'annual',
        fiscalYear: entry.year,
        fiscalQuarter: null,
        periodEnd: `${entry.year}-09-30`,
        knownAt: `${entry.year}-11-01T00:00:00Z`,
        source: 'fixture',
        sourceUpdatedAt: null,
        ingestedAt: null,
        methodologyVersion: 'fixture',
        dataQualityFlags: {},
      }]
    )))
  return {
    available: true,
    reason: rows.length ? null : 'no_financial_statement_rows',
    symbol: ticker,
    latestOnly: true,
    limit: 500,
    truncated: false,
    count: rows.length,
    rows,
  }
}

/** Quarterly dividends per share for QAS since 2017, rising once a year. Invented. */
export function tickerCorporateActionsFixture(ticker) {
  const rows = []
  if (ticker === 'QAS') {
    for (let year = 2017; year <= 2026; year += 1) {
      for (const month of ['02', '05', '08', '11']) {
        const exDate = `${year}-${month}-09`
        if (exDate > '2026-09-30') continue
        const amount = Number((0.12 * 1.06 ** (year - 2017)).toFixed(3))
        rows.push({
          eventId: `qas-dividend-${exDate}`,
          symbol: 'QAS',
          actionType: 'dividend',
          exDate,
          paymentDate: null,
          cashAmount: amount,
          adjustedCashAmount: amount,
          frequency: 'quarterly',
          currency: 'USD',
          knownAt: `${exDate}T00:00:00Z`,
          source: 'fixture',
          methodologyVersion: 'fixture',
        })
      }
    }
  }
  rows.reverse()
  return {
    available: true,
    reason: rows.length ? null : 'no_corporate_action_event_observations',
    symbol: ticker,
    count: rows.length,
    rows,
  }
}

/** Latest fundamentals for the summary: the figures the Overview and Fundamentals share. */
export function tickerLatestFundamentalsFixture(ticker) {
  const rows = {
    QAS: [['operating_margin', 'Operating Margin', 0.302], ['net_margin', 'Net Margin', 0.241], ['net_cash', 'Net Cash', 42e9]],
    QAM: [['operating_margin', 'Operating Margin', 0.113], ['net_cash', 'Net Cash', -12.5e9]],
  }[ticker] ?? []
  return rows.map(([metric, metricLabel, valueNumber]) => ({
    ticker,
    metric,
    metricLabel,
    valueNumber,
    valueDisplay: null,
    unit: null,
    periodEnd: '2025-09-30',
    asOf: '2025-11-01',
  }))
}

/**
 * Valuation multiples from market metrics. Invented. QAS reports three years of
 * weekly P/E and ten weeks of P/S; QAM ten weeks of P/E; QAL none. Rows come
 * newest first, as the read model orders them, with one day revised.
 */
export function tickerMarketMetricsFixture(ticker, metric) {
  const plans = {
    QAS: { trailing_pe: { weeks: 156, base: 24, swing: 6 }, price_to_sales: { weeks: 10, base: 6.4, swing: 0.6 } },
    QAM: { trailing_pe: { weeks: 10, base: 31, swing: 4 } },
  }
  const plan = plans[ticker]?.[metric]
  const rows = []
  if (plan) {
    for (let week = 0; week < plan.weeks; week += 1) {
      const date = new Date(LAST_DATE - week * 7 * DAY_MS).toISOString().slice(0, 10)
      const value = Number((plan.base + plan.swing * Math.sin(week / 9) + (week % 5) * 0.15).toFixed(2))
      rows.push({
        symbol: ticker, metric, value, currency: null, observationDate: date,
        knownAt: `${date}T21:00:00Z`, source: 'fixture', sourceUpdatedAt: null, ingestedAt: null,
        methodologyVersion: 'fixture', dataQualityFlags: {},
      })
    }
    // An earlier, superseded reading of the latest day: the later one must win.
    if (rows.length) rows.push({ ...rows[0], value: rows[0].value - 3, knownAt: `${rows[0].observationDate}T12:00:00Z` })
  }
  return { available: true, reason: rows.length ? null : 'no_market_metric_observations', symbol: ticker, count: rows.length, rows }
}

/**
 * Equity capital events. Invented. QAS reports quarterly buyback executions
 * since 2019 and one shelf registration with an executed amount, which is not
 * a buyback and must be left out. QAM and QAL report none.
 */
export function tickerEquityCapitalEventsFixture(ticker) {
  const rows = []
  if (ticker === 'QAS') {
    for (let year = 2019; year <= 2026; year += 1) {
      for (const [start, end] of [['01-01', '03-31'], ['04-01', '06-30'], ['07-01', '09-30'], ['10-01', '12-31']]) {
        const periodEnd = `${year}-${end}`
        if (periodEnd > '2026-09-30') continue
        const averagePrice = Number((150 + (year - 2019) * 22 + Number(end.slice(0, 2)) * 0.8).toFixed(2))
        const shares = Math.round((22e6 - (year - 2019) * 1.2e6))
        rows.push({
          eventId: `qas-buyback-${periodEnd}`, eventFamily: 'capital_return', eventType: 'share_repurchase', eventSubtype: 'open_market',
          programName: null, announcementDate: null, filingDate: null, effectiveDate: null,
          periodStart: `${year}-${start}`, periodEnd, amountExecuted: Math.round(shares * averagePrice),
          shareCountExecuted: shares, averagePrice, currency: 'USD', knownAt: `${periodEnd}T00:00:00Z`, source: 'fixture',
        })
      }
    }
    rows.push({
      eventId: 'qas-shelf-2024', eventFamily: 'capital_raise', eventType: 'shelf_registration', eventSubtype: null,
      programName: null, announcementDate: '2024-02-01', filingDate: '2024-02-01', effectiveDate: null,
      periodStart: null, periodEnd: null, amountExecuted: 3e9, shareCountExecuted: null, averagePrice: null,
      currency: 'USD', knownAt: '2024-02-01T00:00:00Z', source: 'fixture',
    })
  }
  rows.reverse()
  return { available: true, reason: rows.length ? null : 'no_equity_capital_event_observations', symbol: ticker, count: rows.length, rows }
}

/** Disclosures for QAS: one invented guidance update, for the Events layer. */
export function tickerDisclosuresFixture(ticker) {
  const rows = ticker === 'QAS' ? [{
    domain: 'guidance', eventId: 'qas-guidance-2026-05', symbol: 'QAS', eventType: 'revenue_guidance',
    title: 'Full-year revenue outlook', classification: 'candidate', occursAt: '2026-05-04T00:00:00Z',
    occursAtRole: 'observed_at', knownAt: '2026-05-04T00:00:00Z', source: 'fixture', primarySource: null,
    sourceMetadata: {}, dataQualityFlags: {}, confidence: 'high',
  }] : []
  return { available: true, reason: null, symbol: ticker, count: rows.length, snapshotMode: 'latest', isPointInTime: false, unavailableDomains: [], rows }
}
