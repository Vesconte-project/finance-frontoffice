import assert from 'node:assert/strict'
import test from 'node:test'
import { compareFrom, percentTicks } from '../lib/currency-compare'
import { convertedOhlcFromRows } from '../lib/display-currency'

test('currencies are compared from the same first day, on the same days only', () => {
  const result = compareFrom([
    { code: 'KRW', points: [{ date: '2026-01-01', value: 100 }, { date: '2026-01-02', value: 110 }, { date: '2026-01-03', value: 120 }] },
    { code: 'USD', points: [{ date: '2026-01-02', value: 10 }, { date: '2026-01-03', value: 11.5 }] },
  ], '2026-01-01')
  assert.deepEqual(result.dates, ['2026-01-02', '2026-01-03'])
  assert.equal(result.leftOut, 1)
  assert.deepEqual(result.lines.map((line) => line.changes[0]), [0, 0])
  assert.ok(Math.abs(result.lines[0].last - (120 / 110 - 1)) < 1e-12)
  assert.ok(Math.abs(result.lines[1].last - 0.15) < 1e-12)
  // Before the start, and with fewer than two common days, nothing is drawn.
  assert.deepEqual(compareFrom([{ code: 'KRW', points: [{ date: '2026-01-03', value: 1 }] }], '2026-01-01').lines, [])
})

test('percent gridlines fall on round values', () => {
  assert.deepEqual(percentTicks(-0.05, 0.31), [0, 0.1, 0.2, 0.3])
  assert.deepEqual(percentTicks(0, 0.08), [0, 0.02, 0.04, 0.06, 0.08])
})

test('bars convert at each day’s rate; a day without a converted close is left out', () => {
  const money = (value: number, converted: number | null) => ({ value, currency: 'KRW', sourceCurrency: 'KRW', date: '2026-01-02', price_basis: 'adjusted',
    converted: converted === null ? null : { value: converted, currency: 'USD', rate: 0.001, rateDate: '2026-01-02' }, unconvertedReason: converted === null ? 'no_rate' : null })
  const rows = [
    { date: '2026-01-02', price_basis: 'adjusted', open: 100, high: 110, low: 90, close: 105, volume: 7,
      money: { open: money(100, 0.1), high: money(110, 0.11), low: money(90, null), close: money(105, 0.105) } },
    { date: '2026-01-03', price_basis: 'adjusted', open: 100, high: 110, low: 90, close: 105, volume: 7,
      money: { close: money(105, null) } },
  ]
  assert.deepEqual(convertedOhlcFromRows(rows, 'USD'), [{ price_basis: 'adjusted', date: '2026-01-02', open: 0.1, high: 0.11, low: null, close: 0.105, volume: 7 }])
})

test('price-unit indicators take each day’s conversion; RSI does not change', async () => {
  const { convertedTechnicalSeries } = await import('../lib/display-currency')
  const entry = (value: number, converted: number | null) => ({ value, currency: 'KRW', sourceCurrency: 'KRW', date: '2026-01-02', price_basis: 'adjusted',
    converted: converted === null ? null : { value: converted, currency: 'USD', rate: 0.001, rateDate: '2026-01-02' }, unconvertedReason: converted === null ? 'no_rate' : null })
  const payload = { price_basis: 'adjusted', series: [
    { key: 'sma_20', unit: 'price', points: [{ date: '2026-01-02', price_basis: 'adjusted', value: 100, money: { value: entry(100, 0.1) } }, { date: '2026-01-03', price_basis: 'adjusted', value: 101, money: { value: entry(101, null) } }] },
    { key: 'rsi_14', unit: 'index_0_100', points: [{ date: '2026-01-02', price_basis: 'adjusted', value: 55 }] },
  ] }
  const result = convertedTechnicalSeries(payload, 'USD') as typeof payload
  assert.deepEqual(result.series[0].points.map((point) => point.value), [0.1, null])
  assert.equal(result.series[1].points[0].value, 55)
})
