import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  convertedAmountOf,
  localizeHolder,
  localizeRows,
  localizeSummary,
  convertedClosesFromHistory,
  currencyName,
  indexedInBothCurrencies,
  convertedValueOf,
  currencyDecomposition,
  displayCurrencyCode,
  isListedCurrency,
  missingPriceConversions,
  isoCurrency,
  parseConvertedCloses,
  parseCurrenciesPayload,
  parseMoneyEntry,
  parseTrackedListings,
  withDisplayCurrency,
} from '../lib/display-currency'

test('currency coverage counts unavailable prefix and internal sessions without filling them', () => {
  const reported = ['1991-01-04','2010-01-01','2026-06-05','2026-11-06'].map(date => ({ date }))
  const converted = [reported[1], reported[3]]
  assert.deepEqual(missingPriceConversions(reported, converted), ['1991-01-04','2026-06-05'])
  assert.deepEqual(missingPriceConversions(reported, reported), [])
  assert.deepEqual(missingPriceConversions(reported, []), reported.map(point => point.date))
})

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

test('the tabs read their amounts in the display currency; indicators and signals stay as reported', () => {
  // Founder, 2026-11-05: the header choice changes the ticker's amounts on every tab.
  for (const [file, reads] of [
    ['app/(app)/stocks/[ticker]/fundamentals/page.tsx', [/getStockResearchData\(ticker, displayCurrency\)/, /displayCurrency \}\)/]],
    ['app/(app)/stocks/[ticker]/financials/page.tsx', [/getStockResearchIdentity\(ticker, displayCurrency\)/, /displayCurrency \}\)/]],
    ['app/(app)/stocks/[ticker]/ownership/page.tsx', [/getStockResearchData\(ticker, displayCurrency\)/, /getClosesIn\(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX, data\.displayCurrency\)/]],
    ['app/(app)/stocks/[ticker]/events/page.tsx', [/getStockResearchIdentity\(ticker, displayCurrency\)/, /getClosesIn\(/]],
    ['app/(app)/stocks/[ticker]/valuation/page.tsx', [/getStockResearchData\(ticker, displayCurrency\)/]],
  ] as const) {
    const source = readFileSync(file, 'utf8')
    for (const read of reads) assert.match(source, read, file)
  }
  // Earnings figures carry no currency, so the Events tab formats them in the listing's.
  assert.match(readFileSync('components/stocks/StockEventsResearch.tsx', 'utf8'), /EarningsAgainstEstimate rows=\{history\} currency=\{data\.listingCurrency\}/)
  // Signals and the bars that feed the technical summary are read as reported.
  assert.doesNotMatch(readFileSync('app/(app)/stocks/[ticker]/signals/page.tsx', 'utf8'), /display-currency|displayCurrency/)
  const overview = readFileSync('app/(app)/stocks/[ticker]/page.tsx', 'utf8')
  // The bars that feed the technical summary are read as reported.
  assert.match(overview, /getOhlcData\(context\.ticker, periodDays, expectsPrices, requestCurrency\)/)
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

test('both lines start at 100 on the first day with a conversion and compare the same days', () => {
  const points = [
    { date: '2026-01-02', close: 100, converted: null, price_basis: 'adjusted' as const },
    { date: '2026-01-05', close: 200, converted: 10, price_basis: 'adjusted' as const },
    { date: '2026-01-06', close: 300, converted: null, price_basis: 'adjusted' as const },
    { date: '2026-01-07', close: 400, converted: 22, price_basis: 'adjusted' as const },
  ]
  const { listing, display } = indexedInBothCurrencies(points)
  assert.deepEqual(listing, [{ date: '2026-01-05', value: 100 }, { date: '2026-01-07', value: 200 }])
  assert.deepEqual(display.map((point) => point.date), ['2026-01-05', '2026-01-07'])
  assert.ok(Math.abs(display[1].value - 220) < 1e-9)
  // The lines end where the decomposition says: listing return and display return over the same days.
  const split = currencyDecomposition(points).result!
  assert.ok(Math.abs(listing[1].value / 100 - 1 - split.localReturn) < 1e-9)
  assert.ok(Math.abs(display[1].value / 100 - 1 - split.convertedReturn) < 1e-9)
  assert.deepEqual(indexedInBothCurrencies(points.slice(0, 2)), { listing: [], display: [] })
})

test('currencies are named in words when the runtime knows them', () => {
  assert.equal(currencyName('KRW'), 'South Korean won')
  assert.equal(currencyName('USD'), 'US dollar')
  assert.equal(currencyName('EUR'), 'euro')
  assert.equal(currencyName('ZZZ'), 'ZZZ')
})

test('an amount that is not a price converts without a price basis, and only into the currency asked for', () => {
  const holder = { marketCap: 1.4e15, money: { marketCap: { value: 1.4e15, currency: 'KRW', sourceCurrency: 'KRW', date: '2026-11-02',
    converted: { value: 5.7e12, currency: 'BRL', rate: 0.0041, rateDate: '2026-11-02' }, unconvertedReason: null } } }
  assert.equal(convertedAmountOf(holder, 'marketCap', 'BRL')?.value, 5.7e12)
  assert.equal(convertedAmountOf(holder, 'marketCap', 'USD'), null)
  assert.equal(convertedAmountOf({ marketCap: 1 }, 'marketCap', 'BRL'), null)
})

const conv = (value: number, converted: number | null, reason: string | null = null) => ({
  value, currency: 'KRW', sourceCurrency: 'KRW', date: '2026-10-01',
  converted: converted === null ? null : { value: converted, currency: 'BRL', rate: 0.004, rateDate: '2026-10-01' },
  unconvertedReason: reason,
})

test('a read is shown in the display currency all or none, so a chart never mixes currencies', () => {
  const rows = [
    { lineItemId: 'revenue', value: 1000, currency: 'KRW', money: { value: conv(1000, 4) } },
    { lineItemId: 'revenueGrowth', value: 0.1, currency: null },
    { lineItemId: 'netIncome', value: 200, currency: 'KRW', money: { value: conv(200, 0.8) } },
  ]
  const all = localizeRows(rows, 'BRL')
  assert.equal(all.converted, true)
  assert.deepEqual(all.rows.map((row) => [row.value, row.currency]), [[4, 'BRL'], [0.1, null], [0.8, 'BRL']])
  // One amount without a rate: the read stays as reported.
  const gap = localizeRows([...rows, { lineItemId: 'cash', value: 5, currency: 'KRW', money: { value: conv(5, null, 'no_rate') } }], 'BRL')
  assert.equal(gap.converted, false)
  assert.equal(gap.rows[0].value, 1000)
  // Converted into another currency than asked: not used.
  assert.equal(localizeRows(rows, 'USD').converted, false)
})

test('amounts without a known currency stay as reported; the summary converts all or none', () => {
  const estimate = localizeHolder({ epsEstimate: 2.9, money: { epsEstimate: conv(2.9, null, 'currency_unknown') } }, 'BRL')
  assert.deepEqual([estimate.ok, estimate.converted, estimate.holder.epsEstimate], [true, false, 2.9])
  const summary = {
    quote: { price: 75000, money: { price: conv(75000, 300) } },
    fundamentalsSummary: { currency: 'KRW', marketCap: 1e15, money: { marketCap: conv(1e15, 4e12) } },
    latestFundamentals: [{ metric: 'revenue', valueNumber: 9, currency: 'KRW', money: { valueNumber: conv(9, 0.036) } }],
    earningsHistory: [{ epsActual: 2, money: { epsActual: conv(2, null, 'currency_unknown') } }],
  }
  const result = localizeSummary(summary, 'BRL')
  assert.equal(result.converted, true)
  assert.equal(result.summary.quote.price, 300)
  assert.equal(result.summary.fundamentalsSummary.currency, 'BRL')
  assert.equal(result.summary.latestFundamentals[0].currency, 'BRL')
  assert.equal(result.summary.earningsHistory[0].epsActual, 2)
  const stale = localizeSummary({ ...summary, quote: { price: 75000, money: { price: conv(75000, null, 'no_rate') } } }, 'BRL')
  assert.equal(stale.converted, false)
  assert.equal(stale.summary.quote.price, 75000)
})
