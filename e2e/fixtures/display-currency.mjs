/**
 * Synthetic display-currency support for the fixture backend, in the shape of
 * finance-backend's Display Currency Contract (README "Display Currency
 * Contract", app/fx.py, app/ticker_money.py). Every rate is invented.
 *
 * - `GET /v1/currencies`: USD first, then EUR and KRW.
 * - `?currency=XXX` on the fixture ticker reads: each amount gains a `money`
 *   entry, converted at the rate of its own date through USD. KRW has no rate
 *   before 2019-01-01, so the earliest won amounts stay unconverted
 *   (`no_rate`), and none is published for June 2026 either, so the chart's
 *   converted view has days without a rate inside its default range; earnings
 *   carry no currency (`currency_unknown`).
 * - An unlisted currency answers 422 `unsupported_currency`.
 */

const RATES = {
  USD: { from: null, usdPerUnit: () => 1 },
  EUR: { from: '2010-01-01', usdPerUnit: (day) => 1.08 + 0.02 * Math.sin(dayNumber(day) / 90) },
  KRW: { from: '2019-01-01', gaps: [['2026-06-01', '2026-06-30']], usdPerUnit: (day) => 0.00072 + 0.00002 * Math.sin(dayNumber(day) / 120) },
}

const LIST = [
  { code: 'USD', latestRateDate: null, status: 'ok' },
  { code: 'EUR', latestRateDate: '2026-09-30', status: 'ok' },
  { code: 'KRW', latestRateDate: '2026-09-30', status: 'ok' },
]

const MONETARY_LINE_ITEMS = new Set(['revenue', 'eps', 'net_income', 'gross_profit', 'operating_income', 'ebitda', 'free_cash_flow', 'total_assets', 'total_liabilities'])
const MONETARY_METRICS = new Set(['market_cap', 'dividend_rate', 'trailing_annual_dividend_rate'])

function dayNumber(day) {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000)
}

/** The latest weekday at or before `day`: rates are published on weekdays. */
function rateDay(day) {
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export function currenciesFixture() {
  return { available: true, reason: null, pivot: 'USD', maxStalenessBusinessDays: 10, currencies: LIST }
}

export function isListedCurrency(code) {
  return LIST.some((option) => option.code === code)
}

export function unsupportedCurrencyFixture() {
  return { detail: { error: 'unsupported_currency', availableCurrencies: LIST.map((option) => option.code) } }
}

function entry(value, currency, day, target) {
  const base = { value, currency, sourceCurrency: currency, date: day ?? null, converted: null, unconvertedReason: null }
  if (!currency) return { ...base, unconvertedReason: 'currency_unknown' }
  if (!day) return { ...base, unconvertedReason: 'value_date_unknown' }
  if (currency === target) return { ...base, converted: { value, currency: target, rate: 1, rateDate: null } }
  const on = rateDay(day)
  const from = RATES[currency]
  const to = RATES[target]
  const missing = (rates) => !rates || (rates.from && on < rates.from) || (rates.gaps ?? []).some(([start, end]) => on >= start && on <= end)
  if (missing(from) || missing(to)) return { ...base, unconvertedReason: 'no_rate' }
  const rate = from.usdPerUnit(on) / to.usdPerUnit(on)
  return { ...base, converted: { value: Number((value * rate).toFixed(6)), currency: target, rate: Number(rate.toPrecision(8)), rateDate: on } }
}

function add(holder, field, currency, day, target) {
  if (!holder || typeof holder[field] !== 'number') return
  holder.money ??= {}
  holder.money[field] = { ...entry(holder[field], currency, day, target), price_basis: holder.price_basis ?? null }
}

/** The payload of a fixture ticker read, annotated for `target` as the backend would. */
export function annotateFixture(kind, payload, { listingCurrency, target }) {
  const copy = structuredClone(payload)
  if (kind === 'summary') {
    add(copy.quote, 'price', listingCurrency, copy.quote?.asOf?.slice(0, 10), target)
    add(copy.quote, 'change', listingCurrency, copy.quote?.asOf?.slice(0, 10), target)
    if (copy.marketStats) add(copy.marketStats, 'lastPrice', listingCurrency, copy.marketStats.asOfDate, target)
    for (const field of ['epsEstimate', 'revenueEstimate']) add(copy.nextEarnings, field, null, copy.nextEarnings?.asOf, target)
    for (const row of copy.earningsHistory ?? []) {
      for (const field of ['epsActual', 'epsEstimate', 'revenueActual', 'revenueEstimate']) add(row, field, null, row.earningsDate, target)
    }
    // Net cash and margins are not amounts the backend annotates.
    return copy
  }
  if (kind === 'ohlc' || kind === 'history') {
    for (const row of copy) {
      for (const field of kind === 'ohlc' ? ['open', 'high', 'low', 'close'] : ['close']) add(row, field, listingCurrency, row.date, target)
    }
    return copy
  }
  if (kind === 'financial-statements') {
    for (const row of copy.rows) if (MONETARY_LINE_ITEMS.has(row.lineItemId)) add(row, 'value', row.currency, row.periodEnd, target)
    return copy
  }
  if (kind === 'market-metrics') {
    for (const row of copy.rows) if (MONETARY_METRICS.has(row.metric)) add(row, 'value', row.currency, row.observationDate, target)
    return copy
  }
  if (kind === 'corporate-actions') {
    for (const row of copy.rows) for (const field of ['cashAmount', 'adjustedCashAmount']) add(row, field, row.currency, row.exDate, target)
    return copy
  }
  if (kind === 'equity-capital-events') {
    for (const row of copy.rows) {
      const announced = row.announcementDate ?? row.filingDate
      const executed = row.periodEnd ?? row.filingDate
      for (const field of ['amountAuthorized', 'amountAnnounced']) add(row, field, row.currency, announced, target)
      for (const field of ['amountExecuted', 'averagePrice']) add(row, field, row.currency, executed, target)
    }
    return copy
  }
  return copy
}
