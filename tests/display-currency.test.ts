import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  convertedClosesFromHistory,
  convertedValueOf,
  currencyDecomposition,
  displayCurrencyCode,
  isListedCurrency,
  isoCurrency,
  parseConvertedCloses,
  parseCurrenciesPayload,
  parseMoneyEntry,
  parseTrackedListings,
  withDisplayCurrency,
} from '../lib/display-currency'

const converted = (value: number, original: number, currency = 'KRW') => ({
  price_basis: 'adjusted',
  value: original,
  currency,
  sourceCurrency: currency,
  date: '2026-10-13',
  converted: { value, currency: 'USD', rate: value / original, rateDate: '2026-10-12' },
  unconvertedReason: null,
})

const unconverted = (original: number, reason: string, currency: string | null = 'KRW') => ({
  price_basis: 'adjusted',
  value: original,
  currency,
  sourceCurrency: currency,
  date: '2026-10-13',
  converted: null,
  unconvertedReason: reason,
})

test('a conversion is read only into the currency asked for, never from a malformed block', () => {
  const holder = { price_basis: 'raw', price: 75000, money: { price: {...converted(54.12, 75000), price_basis:'raw'}, change: unconverted(500, 'no_rate') } }
  assert.deepEqual(convertedValueOf(holder, 'price', 'USD'), { value: 54.12, currency: 'USD', rate: 54.12 / 75000, rateDate: '2026-10-12' })
  assert.equal(convertedValueOf(holder, 'price', 'EUR'), null)
  assert.equal(convertedValueOf(holder, 'change', 'USD'), null)
  assert.equal(convertedValueOf({ price: 1 }, 'price', 'USD'), null)
  assert.equal(parseMoneyEntry(null), null)
  const entry = parseMoneyEntry({ value: 5, currency: 'KRW', converted: { value: 'NaN', currency: 'USD' } })
  assert.equal(entry?.converted, null)
  assert.equal(entry?.unconvertedReason, 'no_rate')
  assert.equal(parseMoneyEntry({ value: 5, converted: null, unconvertedReason: 'made_up' })?.unconvertedReason, 'no_rate')
})

test('history keeps every reported close and the backend conversion of each day, null when it has none', () => {
  const rows = [
    { price_basis: 'adjusted' as const, date: '2026-01-05', close: 70000, money: { close: converted(49, 70000) } },
    { price_basis: 'adjusted' as const, date: '2026-01-06', close: 71000, money: { close: unconverted(71000, 'no_rate') } },
    { price_basis: 'adjusted' as const, date: '2026-01-07', close: 72000 },
    { price_basis: 'adjusted' as const, date: '2026-01-02', close: 69000, money: { close: converted(48.3, 69000) } },
    { price_basis: 'adjusted' as const, date: 'bad', close: null },
  ]
  const points = convertedClosesFromHistory(rows, 'USD')
  assert.deepEqual(points, [
    { price_basis: 'adjusted' as const, date: '2026-01-02', close: 69000, converted: 48.3 },
    { price_basis: 'adjusted' as const, date: '2026-01-05', close: 70000, converted: 49 },
    { price_basis: 'adjusted' as const, date: '2026-01-06', close: 71000, converted: null },
    { price_basis: 'adjusted' as const, date: '2026-01-07', close: 72000, converted: null },
  ])
  assert.deepEqual(parseConvertedCloses(points), points)
  assert.deepEqual(parseConvertedCloses([{ price_basis: 'adjusted' as const, date: 'x', close: 1, converted: 'y' }, { price_basis: 'adjusted' as const, date: 'x', close: 2, converted: null }]), [{ price_basis: 'adjusted' as const, date: 'x', close: 2, converted: null }])
  assert.deepEqual(parseConvertedCloses({}), [])
})

test('the range return splits exactly into the local return and the currency effect; days without a rate are counted', () => {
  const { result, excludedDays } = currencyDecomposition([
    { price_basis: 'adjusted' as const, date: '2026-01-01', close: 100, converted: null },
    { price_basis: 'adjusted' as const, date: '2026-01-02', close: 100, converted: 50 },
    { price_basis: 'adjusted' as const, date: '2026-01-03', close: 105, converted: null },
    { price_basis: 'adjusted' as const, date: '2026-01-04', close: 110, converted: 60.5 },
    { price_basis: 'adjusted' as const, date: '2026-01-05', close: 120, converted: null },
  ])
  assert.equal(excludedDays, 3)
  assert.ok(result)
  assert.equal(result.from, '2026-01-02')
  assert.equal(result.to, '2026-01-04')
  assert.equal(result.usedDays, 2)
  assert.ok(Math.abs(result.localReturn - 0.1) < 1e-12)
  assert.ok(Math.abs(result.convertedReturn - 0.21) < 1e-12)
  assert.ok(Math.abs(result.currencyEffect - 0.1) < 1e-12)
  // (1 + r_ccy) = (1 + r_local)(1 + r_fx)
  assert.ok(Math.abs((1 + result.convertedReturn) - (1 + result.localReturn) * (1 + result.currencyEffect)) < 1e-12)

  const thin = currencyDecomposition([{ price_basis: 'adjusted' as const, date: '2026-01-01', close: 1, converted: 1 }, { price_basis: 'adjusted' as const, date: '2026-01-02', close: 1, converted: null }])
  assert.equal(thin.result, null)
  assert.equal(thin.excludedDays, 1)
})

test('the listings block is read as sent; absent or malformed is null, unavailable has no items', () => {
  assert.equal(parseTrackedListings(undefined), null)
  assert.equal(parseTrackedListings({ items: [] }), null)
  assert.deepEqual(parseTrackedListings({ available: false, reason: 'symbol_absent', items: [{ symbol: 'X' }] }), { available: false, reason: 'symbol_absent', items: [] })
  const listings = parseTrackedListings({
    available: true,
    reason: null,
    items: [
      { symbol: 'QAKY', exchange: null, exchangeMic: 'otcm', country: 'us', currency: 'USD', isPrimary: false, isCurrent: false },
      { symbol: 'QAK', exchange: 'KSC', exchangeMic: 'XKRX', country: 'KR', currency: 'KRW', isPrimary: true, isCurrent: true },
      { symbol: 'QAK', exchange: 'dup' },
      { symbol: 'bad symbol!' },
      { symbol: 'QAKL', currency: 'GBp', isPrimary: 'yes' },
    ],
  })
  assert.deepEqual(listings?.items.map((item) => item.symbol), ['QAK', 'QAKL', 'QAKY'])
  assert.deepEqual(listings?.items[0], { symbol: 'QAK', exchange: 'KSC', exchangeMic: 'XKRX', country: 'KR', currency: 'KRW', isPrimary: true, isCurrent: true })
  assert.equal(listings?.items[1].currency, 'GBP')
  assert.equal(listings?.items[1].isPrimary, false, 'only `true` is primary')
  assert.equal(listings?.items[2].exchangeMic, 'OTCM')
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

test('links carry the display currency in the URL, the only place it lives', () => {
  assert.equal(withDisplayCurrency('/stocks/QAK/fundamentals', 'USD'), '/stocks/QAK/fundamentals?currency=USD')
  assert.equal(withDisplayCurrency('/stocks/QAK/signals?family=oscillators', 'EUR'), '/stocks/QAK/signals?family=oscillators&currency=EUR')
  assert.equal(withDisplayCurrency('/stocks/QAK?currency=USD#top', null), '/stocks/QAK#top')
  for (const file of ['hooks/useDisplayCurrency.ts', 'components/stocks/DisplayCurrencySelect.tsx', 'lib/display-currency.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /localStorage|sessionStorage/, `${file} keeps no browser preference`)
  }
})

test('indicators, signals, scorecards and statements never read a display currency', () => {
  for (const file of [
    'app/(app)/stocks/[ticker]/financials/page.tsx',
    'app/(app)/stocks/[ticker]/fundamentals/page.tsx',
    'app/(app)/stocks/[ticker]/signals/page.tsx',
    'lib/canonical-research.ts',
    'lib/statement-reading.ts',
    'lib/stock-research.ts',
  ]) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /display-currency|displayCurrency/, file)
  }
  const overview = readFileSync('app/(app)/stocks/[ticker]/page.tsx', 'utf8')
  // The bars that feed the technical summary are read as reported.
  assert.match(overview, /getOhlcData\(context\.ticker, 3650, expectsPrices\)/)
})


test('price conversion refuses a different or missing basis without substituting raw prices', () => {
  const adjusted = { price_basis: 'adjusted', date: '2026-01-05', close: 100, money: { close: converted(50, 100) } }
  assert.equal(convertedClosesFromHistory([adjusted], 'USD')[0].converted, 50)
  for (const basis of ['raw', undefined]) {
    assert.throws(() => convertedClosesFromHistory([{ ...adjusted, price_basis: basis }], 'USD'), /adjusted_price_input_invalid/)
    assert.deepEqual(parseConvertedCloses([{ ...adjusted, price_basis: basis, converted: 50 }]), [])
    assert.equal(convertedClosesFromHistory([{ ...adjusted, money: { close: { ...converted(50, 100), price_basis: basis } } }], 'USD')[0].converted, null)
  }
  const quote = { price_basis: 'raw', price: 100, money: { price: converted(50, 100) } }
  assert.equal(convertedValueOf(quote, 'price', 'USD'), null)
  assert.equal(convertedValueOf({ ...quote, money: { price: { ...converted(50, 100), price_basis: 'raw' } } }, 'price', 'USD')?.value, 50)
})
