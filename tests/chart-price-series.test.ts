import assert from 'node:assert/strict'
import test from 'node:test'
import { barsForRange, chartCurrencySeries, viewForRange, availableRanges, rangeStartIndex } from '../lib/expanded-chart'
import { getOhlcData, getConvertedOhlc } from '../lib/finance'
import { STOCK_DAILY_OHLC_CACHE_KEY, STOCK_OHLC_CACHE_KEY, type OhlcPoint } from '../lib/ohlc-data'

const bar = (date: string, close = 10): OhlcPoint => ({ date, close, price_basis: 'adjusted', open: close, high: close, low: close, volume: 100 })
const weekly = [bar('2000-01-03'), bar('2026-10-30'), bar('2026-11-06')]
const daily = [bar('2026-11-04'), bar('2026-11-05'), bar('2026-11-06')]

test('every short range uses confirmed daily rows; long ranges retain the complete weekly series', () => {
  for (const range of ['1M', '3M', 'YTD', '1Y']) assert.equal(barsForRange(range, weekly, daily, 'daily'), daily)
  for (const range of ['5Y', '10Y', 'ALL']) assert.equal(barsForRange(range, weekly, daily, 'daily'), weekly)
})

test('weekly, unknown or missing recent data falls back to full history for all short ranges', () => {
  for (const range of ['1M', '3M', 'YTD', '1Y']) {
    for (const resolution of ['weekly', null] as const) assert.equal(barsForRange(range, weekly, daily, resolution), weekly)
    assert.equal(barsForRange(range, weekly, [], 'daily'), weekly)
  }
})

test('a new listing keeps ALL while short ranges use its available daily history', () => {
  assert.ok(availableRanges(daily).includes('ALL'))
  assert.equal(barsForRange('ALL', daily, daily, 'daily'), daily)
  assert.equal(rangeStartIndex(daily, '1Y'), 0)
})

test('a failed conversion in either series keeps the same listing currency at every range', () => {
  const convertedFull = weekly.map(row => ({ ...row, close: 8 }))
  const convertedRecent = daily.map(row => ({ ...row, close: 8 }))
  const converted = chartCurrencySeries(weekly, daily, convertedFull, convertedRecent)
  assert.equal(converted.converted, true)
  assert.equal(converted.full, convertedFull)
  assert.equal(converted.recent, convertedRecent)
  for (const [full, recent] of [[null, convertedRecent], [convertedFull, null], [[], convertedRecent], [convertedFull, []]]) {
    const result = chartCurrencySeries(weekly, daily, full, recent)
    assert.equal(result.converted, false)
    assert.equal(result.full, weekly)
    assert.equal(result.recent, daily)
  }
})

test('ALL includes the oldest and newest visible bar even with thousands of weekly rows', () => {
  const long = Array.from({ length: 1800 }, () => weekly[0])
  const view = viewForRange(long, 'ALL')
  assert.ok(view.from <= 0)
  assert.ok(view.to >= long.length - 1)
})

test('OHLC loaders read resolution headers, order both series and use different cache identities', async () => {
  const env = { ...process.env }; const fetcher = globalThis.fetch
  for (const name of ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'VERCEL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']) delete process.env[name]
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  const paths: string[] = []
  let dailyHeader: string | null = 'daily'
  let priorHeader = 'weekly'
  try {
    globalThis.fetch = async input => {
      const url = new URL(String(input)); paths.push(url.pathname + url.search)
      const recent = url.searchParams.get('period_days') === '365'
      const prior = url.searchParams.has('endDate')
      const rows = recent ? [daily[2], daily[0], daily[1], daily[0]] : prior ? [weekly[1], weekly[0]] : [weekly[2]]
      const headers = new Headers()
      const resolution = recent ? dailyHeader : prior ? priorHeader : 'weekly'
      if (resolution) headers.set('x-market-resolution', resolution)
      if (!recent && !prior) headers.set('Link', '</v1/tickers/QATEST/ohlc?endDate=2026-11-05>; rel="next"')
      return Response.json(rows, { headers })
    }
    const full = await getOhlcData('QATEST', 0, true)
    const recent = await getOhlcData('QATEST', 365, true)
    assert.deepEqual(full.rows, weekly)
    assert.deepEqual(recent.rows, daily)
    assert.equal(full.resolution, 'weekly')
    assert.equal(recent.resolution, 'daily')
    assert.equal(full.cacheKey, STOCK_OHLC_CACHE_KEY)
    assert.equal(recent.cacheKey, STOCK_DAILY_OHLC_CACHE_KEY)
    assert.notEqual(full.cacheKey, recent.cacheKey)
    assert.equal(paths.length, 3, 'two full-history pages plus one daily read')
    priorHeader = 'daily'
    const mixed = await getOhlcData('QATEST', 0, true)
    assert.equal(mixed.resolution, null, 'mixed page headers cannot claim a uniform resolution')
    for (dailyHeader of ['weekly', null, 'intraday']) {
      const fallback = await getOhlcData('QATEST', 365, true)
      assert.equal(fallback.resolution, dailyHeader === 'weekly' ? 'weekly' : null)
      assert.equal(barsForRange('1M', full.rows, fallback.rows, fallback.resolution ?? null), full.rows)
    }
  } finally {
    globalThis.fetch = fetcher
    for (const name of Object.keys(process.env)) if (!(name in env)) delete process.env[name]
    Object.assign(process.env, env)
  }
})

test('converted OHLC requests preserve the period and apply identical backend currency values', async () => {
  const env = { ...process.env }; const fetcher = globalThis.fetch
  for (const name of ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'VERCEL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']) delete process.env[name]
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  const periods: string[] = []
  try {
    globalThis.fetch = async input => {
      const url = new URL(String(input)); periods.push(url.searchParams.get('period_days')!)
      assert.equal(url.searchParams.get('currency'), 'EUR')
      const rows = [bar('2026-11-06'), bar('2026-11-05')].map(row => ({ ...row, money: Object.fromEntries(
        ['open', 'high', 'low', 'close'].map(field => [field, {
          price_basis: 'adjusted', value: 10, currency: 'USD', sourceCurrency: 'USD', date: row.date,
          converted: { value: 8, currency: 'EUR', rate: 0.8, rateDate: row.date },
        }]),
      ) }))
      return Response.json(rows, { headers: { 'x-market-resolution': 'daily' } })
    }
    for (const period of [0, 365]) {
      const rows = await getConvertedOhlc('QATEST', 'EUR', period)
      assert.deepEqual(rows.map(row => row.date), ['2026-11-05', '2026-11-06'])
      assert.ok(rows.every(row => row.close === 8 && row.open === 8 && row.high === 8 && row.low === 8))
    }
    assert.deepEqual(periods, ['0', '365'])
  } finally {
    globalThis.fetch = fetcher
    for (const name of Object.keys(process.env)) if (!(name in env)) delete process.env[name]
    Object.assign(process.env, env)
  }
})
