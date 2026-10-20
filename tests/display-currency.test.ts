import assert from 'node:assert/strict'
import test from 'node:test'
import { formatCompactMoney, formatMoney } from '../lib/currency'
import {
  amountOf,
  amountView,
  applyDisplayCurrency,
  displayCurrencyCode,
  displayCurrencySummary,
  isListedCurrency,
  isoCurrency,
  mergeReports,
  parseCurrenciesPayload,
  parseMoneyEntry,
  withDisplayCurrency,
} from '../lib/display-currency'
import { annualSeries } from '../lib/statement-reading'

const converted = (value: number, original: number, currency = 'KRW') => ({
  value: original,
  currency,
  sourceCurrency: currency,
  date: '2026-10-13',
  converted: { value, currency: 'USD', rate: value / original, rateDate: '2026-10-12' },
  unconvertedReason: null,
})

const unconverted = (original: number, reason: string, currency: string | null = 'KRW') => ({
  value: original,
  currency,
  sourceCurrency: currency,
  date: '2026-10-13',
  converted: null,
  unconvertedReason: reason,
})

test('the converted value takes the field, the original stays in the money block', () => {
  const rows = [
    { date: '2026-10-13', close: 75000, money: { close: converted(54.12, 75000) } },
    { date: '2026-10-14', close: 76000, money: { close: unconverted(76000, 'no_rate') } },
    { date: '2026-10-15', close: 77000 },
  ]
  const { payload, report } = applyDisplayCurrency(rows, 'USD')
  assert.equal(payload[0].close, 54.12)
  // Never drawn in another currency: no conversion means no value.
  assert.equal(payload[1].close, null)
  // Not annotated: left as it is.
  assert.equal(payload[2].close, 77000)
  assert.equal(rows[0].close, 75000, 'the input is not changed')
  assert.deepEqual(report, { target: 'USD', converted: 1, unconverted: { no_rate: 1 }, unsupported: false })
})

test('holders gain the display currency, nested objects are walked', () => {
  const summary = {
    asset: { currency: 'KRW' },
    fundamentalsSummary: { currency: 'KRW', marketCap: 4e14, money: { marketCap: converted(2.9e11, 4e14) } },
    earningsHistory: [{ revenueActual: 1e12, money: { revenueActual: unconverted(1e12, 'currency_unknown', null) } }],
  }
  const { payload, report } = applyDisplayCurrency(summary, 'USD')
  assert.equal(payload.asset.currency, 'KRW', 'an object without money keeps its currency')
  assert.equal(payload.fundamentalsSummary.currency, 'USD')
  assert.equal(payload.fundamentalsSummary.marketCap, 2.9e11)
  assert.equal(payload.earningsHistory[0].revenueActual, null)
  assert.equal(report.unconverted.currency_unknown, 1)
})

test('a conversion into another currency than the one asked for is not used', () => {
  const { payload, report } = applyDisplayCurrency({ close: 10, money: { close: converted(7, 10) } }, 'EUR')
  assert.equal(payload.close, null)
  assert.equal(report.unconverted.no_rate, 1)
})

test('malformed money entries are never read as converted', () => {
  assert.equal(parseMoneyEntry(null), null)
  assert.equal(parseMoneyEntry('x'), null)
  const entry = parseMoneyEntry({ value: 5, currency: 'KRW', converted: { value: 'NaN', currency: 'USD' } })
  assert.equal(entry?.converted, null)
  assert.equal(entry?.unconvertedReason, 'no_rate')
  const bogus = parseMoneyEntry({ value: 5, currency: 'KRW', converted: null, unconvertedReason: 'made_up' })
  assert.equal(bogus?.unconvertedReason, 'no_rate')
})

test('amounts show converted with the original beside them, or the original marked', () => {
  const { payload } = applyDisplayCurrency({
    price: 75000,
    change: 500,
    netCash: 3e12,
    money: { price: converted(54.12, 75000), change: unconverted(500, 'no_rate') },
  }, 'USD')
  const context = { display: 'USD', original: 'KRW' }
  const price = amountView(amountOf(payload, 'price', context), formatMoney)
  assert.equal(price?.text, '$54.12')
  assert.equal(price?.original, '₩75,000')
  assert.equal(price?.marker, null)
  assert.match(price?.detail ?? '', /Oct 12, 2026/)

  const change = amountView(amountOf(payload, 'change', context), formatMoney)
  assert.match(change?.text ?? '', /500/)
  assert.equal(change?.marker, 'not in USD')
  assert.match(change?.detail ?? '', /10 business days/)

  // The backend did not annotate it: shown as reported and marked.
  const netCash = amountView(amountOf(payload, 'netCash', context), formatCompactMoney)
  assert.equal(netCash?.marker, 'not in USD')
  assert.match(netCash?.detail ?? '', /not offered in other currencies/)

  const reported = amountView(amountOf(payload, 'netCash', { display: null, original: 'KRW' }), formatCompactMoney)
  assert.equal(reported?.marker, null)
  assert.equal(reported?.original, null)
})

test('the original label keeps a minor unit (GBp) while the amount is in its parent', () => {
  const entry = { value: 12.34, currency: 'GBP', sourceCurrency: 'GBp', date: '2026-10-13',
    converted: { value: 15.6, currency: 'USD', rate: 1.264, rateDate: '2026-10-13' }, unconvertedReason: null }
  const { payload } = applyDisplayCurrency({ close: 1234, money: { close: entry } }, 'USD')
  const view = amountView(amountOf(payload, 'close', { display: 'USD', original: 'GBp' }), formatMoney)
  assert.equal(view?.text, '$15.60')
  assert.equal(view?.original, '£12.34')
  assert.match(view?.detail ?? '', /quoted in GBp/)
})

test('statement points carry their original only when converted', () => {
  const row = { lineItemId: 'revenue', displayLabel: null, value: 1e12, currency: 'KRW', periodType: 'annual', fiscalYear: 2025, periodEnd: '2025-12-31' }
  assert.deepEqual(annualSeries([row], 'revenue'), [{ periodEnd: '2025-12-31', year: 2025, value: 1e12, currency: 'KRW' }])
  const { payload } = applyDisplayCurrency([{ ...row, money: { value: converted(7.2e8, 1e12) } }], 'USD')
  const [point] = annualSeries(payload, 'revenue')
  assert.equal(point.value, 7.2e8)
  assert.equal(point.currency, 'USD')
  assert.deepEqual(point.original, { value: 1e12, currency: 'KRW', label: 'KRW' })
})

test('the currency list is parsed defensively and only listed codes are accepted', () => {
  assert.equal(parseCurrenciesPayload(null), null)
  assert.equal(parseCurrenciesPayload({ currencies: 'x' }), null)
  const payload = parseCurrenciesPayload({
    available: true, reason: null, pivot: 'USD', maxStalenessBusinessDays: 10,
    currencies: [{ code: 'USD', latestRateDate: null, status: 'ok' }, { code: 'krw' }, { code: 'KRW', latestRateDate: '2026-10-16', status: 'ok' }, { code: 'KRW' }, 7],
  })
  assert.deepEqual(payload?.currencies.map((option) => option.code), ['USD', 'KRW'])
  assert.equal(isListedCurrency(payload, 'KRW'), true)
  assert.equal(isListedCurrency(payload, 'EUR'), false)
  const unavailable = parseCurrenciesPayload({ available: false, reason: 'fx_tables_unavailable', currencies: [{ code: 'USD' }] })
  assert.equal(isListedCurrency(unavailable, 'USD'), false, 'nothing converts without the rate tables')
  assert.equal(displayCurrencyCode('usd'), null)
  assert.equal(displayCurrencyCode(['EUR']), 'EUR')
  assert.equal(isoCurrency('GBp'), 'GBP')
  assert.equal(isoCurrency('ZAc'), 'ZAR')
})

test('links carry the display currency and the page says what was not converted', () => {
  assert.equal(withDisplayCurrency('/stocks/QAK/fundamentals', 'USD'), '/stocks/QAK/fundamentals?currency=USD')
  assert.equal(withDisplayCurrency('/stocks/QAK/signals?family=oscillators', 'EUR'), '/stocks/QAK/signals?family=oscillators&currency=EUR')
  assert.equal(withDisplayCurrency('/stocks/QAK?currency=USD#top', null), '/stocks/QAK#top')
  const report = mergeReports('USD', [
    { target: 'USD', converted: 3, unconverted: { no_rate: 2 }, unsupported: false },
    { target: 'USD', converted: 1, unconverted: { no_rate: 1, currency_unknown: 1 }, unsupported: false },
    { target: 'EUR', converted: 9, unconverted: { no_rate: 9 }, unsupported: false },
  ])
  assert.deepEqual(report.unconverted, { no_rate: 3, currency_unknown: 1 })
  const summary = displayCurrencySummary(report)
  assert.match(summary?.lead ?? '', /Amounts in USD/)
  assert.match(summary?.gaps ?? '', /^4 amounts have no USD value and are left out of charts or marked “not in USD”: 3 no exchange rate within 10 business days of their date, 1 no recorded currency\.$/)
  const single = displayCurrencySummary({ target: 'USD', converted: 0, unconverted: { no_rate: 1 }, unsupported: false })
  assert.equal(single?.gaps, '1 amount has no USD value (no exchange rate within 10 business days of their date) and is left out of charts or marked “not in USD”.')
  assert.equal(displayCurrencySummary(null), null)
})
