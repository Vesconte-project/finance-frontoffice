import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell, exportTicker, EXPORT_MAX_JSON_BYTES, TickerExportError } from '../lib/ticker-export'

const url = 'https://vesconte.test/api/stocks/AAPL/export'
const now = () => new Date('2026-11-11T12:00:00Z')
const candle = { date: '2026-11-10', open: 101, high: 103, low: 100, close: 102, volume: null, price_basis: 'adjusted' }
const row = { symbol: 'AAPL', statementType: 'income_statement', periodType: 'annual', periodEnd: '2025-12-31', lineItemId: 'revenue', displayLabel: 'Revenue', value: -12.5, currency: 'USD', knownAt: '2026-02-01', methodologyVersion: 'v1', source: 'canonical', dataQualityFlags: ['reported'] }
const financial = (rows: unknown[] = [row]) => ({ available: true, symbol: 'AAPL', latestOnly: true, truncated: false, count: rows.length, rows })
const json = (data: unknown, headers: Record<string, string> = {}) => Response.json(data, { headers })
const query = '?dataset=fundamentals&statement=income_statement&period=annual'
function run(payload: unknown, options: { query?: string; headers?: Record<string, string>; response?: Response } = {}) {
  return exportTicker(new Request(url + (options.query ?? '?dataset=prices')), 'AAPL', {
    now, access: async () => ({ isSignedIn: true, isPro: true }),
    read: async () => options.response ?? json(payload, options.headers ?? { 'x-market-resolution': 'daily' }),
  })
}

test('signed-out, free and failed access checks cannot read or export market data', async () => {
  for (const [viewer, expected] of [[{ isSignedIn: false, isPro: false }, 401], [{ isSignedIn: true, isPro: false }, 403]] as const) {
    const response = await exportTicker(new Request(url + '?dataset=prices'), 'AAPL', {
      access: async () => viewer, read: async () => { assert.fail('must not read backend') },
    })
    assert.equal(response.status, expected)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('content-disposition'), null)
    if (expected === 403) assert.equal((await response.json()).upgradeUrl, '/pricing')
  }
  const response = await exportTicker(new Request(url + '?dataset=prices'), 'AAPL', {
    access: async () => { throw new TickerExportError(503, 'Access unavailable') }, read: async () => { assert.fail() },
  })
  assert.equal(response.status, 503)
})

test('client input cannot inject paths, history windows or duplicate options', async () => {
  for (const suffix of ['?dataset=prices&dataset=fundamentals', '?dataset=prices&period_days=25000', '?dataset=prices&currency=EUR', '?dataset=other', '?dataset=fundamentals', query + '&statement=cash_flow']) {
    const response = await exportTicker(new Request(url + suffix), 'AAPL', { access: async () => { assert.fail() }, read: async () => { assert.fail() } })
    assert.equal(response.status, 400, suffix)
  }
  assert.equal((await exportTicker(new Request(url + '?dataset=prices'), '../secret', { access: async () => { assert.fail() }, read: async () => { assert.fail() } })).status, 400)
})

test('daily export uses one bounded /v1 read, preserves negatives/nulls and names adjusted data', async () => {
  let calls = 0
  const response = await exportTicker(new Request(url + '?dataset=prices'), ' aapl ', {
    now, access: async () => ({ isSignedIn: true, isPro: true }), read: async (path, signal) => {
      calls++
      const requested = new URL(path, 'https://backend.test')
      assert.equal(requested.pathname, '/v1/tickers/AAPL/ohlc')
      assert.equal(requested.searchParams.get('period_days'), '365')
      assert.equal(requested.searchParams.get('startDate'), '2025-11-11')
      assert.equal(requested.searchParams.get('endDate'), '2026-11-11')
      assert.ok(signal instanceof AbortSignal)
      return json([candle], { 'x-market-resolution': 'daily' })
    },
  })
  assert.equal(calls, 1)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition')!, /AAPL_adjusted-prices-daily_2025-11-11_2026-11-11.csv/)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  const body = await response.text()
  assert.match(body, /"volume","price_basis"\r\n/)
  assert.match(body, /"102","","adjusted"\r\n$/)
})

test('weekly, paginated, unlabelled, out-of-window and malformed prices never produce CSV', async () => {
  const variants = [
    { payload: [candle], headers: { 'x-market-resolution': 'weekly' } },
    { payload: [candle], headers: {} },
    { payload: [candle], headers: { 'x-market-resolution': 'daily', link: '</next>; rel="next"' } },
    { payload: [{ ...candle, price_basis: 'raw' }] },
    { payload: [{ ...candle, close: null }] },
    { payload: [{ ...candle, date: '2026-02-30' }] },
    { payload: [{ ...candle, date: '2020-01-01' }] },
    { payload: [candle, candle] },
  ]
  for (const v of variants) {
    const response = await run(v.payload, v.headers ? { headers: v.headers as Record<string, string> } : {})
    assert.notEqual(response.status, 200)
    assert.equal(response.headers.get('content-disposition'), null)
  }
})

test('financial export preserves provenance, flags and reported negative numeric values', async () => {
  const response = await run(financial(), { query })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition')!, /income_statement_annual_latest/)
  const body = await response.text()
  assert.match(body, /"-12.5","USD","2026-02-01","canonical"/)
  assert.match(body, /"\[""reported""\]"/)
  assert.match(body, /"methodology_version","data_quality_flags"/)
})

test('financial selectors stay fixed and revisions are explicitly collapsed by backend', async () => {
  const response = await exportTicker(new Request(url + '?dataset=fundamentals&statement=cash_flow&period=quarterly'), 'AAPL', {
    now, access: async () => ({ isSignedIn: true, isPro: true }), read: async path => {
      const requested = new URL(path, 'https://backend.test')
      assert.equal(requested.pathname, '/v1/tickers/AAPL/financial-statements')
      assert.deepEqual(Object.fromEntries(requested.searchParams), { statementType: 'cash_flow', periodType: 'quarterly', latestOnly: 'true', limit: '500', page: '0' })
      return json(financial([{ ...row, statementType: 'cash_flow', periodType: 'quarterly', value: null }]))
    },
  })
  assert.equal(response.status, 200)
  assert.match(await response.text(), /"Revenue","","USD"/)
})

test('truncation, revision ambiguity, symbol mismatch, duplicate periods and inconsistent counts fail closed', async () => {
  for (const p of [
    { ...financial(), truncated: true }, { ...financial(), latestOnly: false }, { ...financial(), count: 2 },
    { ...financial(), symbol: 'MSFT' }, financial([row, row]), financial([{ ...row, symbol: 'MSFT' }]),
    financial([{ ...row, periodType: 'quarterly' }]), financial([{ ...row, value: 'not a number' }]),
    financial([{ ...row, methodologyVersion: '' }]),
  ]) {
    const response = await run(p, { query })
    assert.notEqual(response.status, 200)
    assert.equal(response.headers.get('content-disposition'), null)
  }
})

test('empty and unavailable are distinguished from a successful download', async () => {
  assert.equal((await run([])).status, 404)
  assert.equal((await run(financial([]), { query })).status, 404)
  assert.equal((await run({ ...financial(), available: false }, { query })).status, 503)
})

test('CSV quotes delimiters and Unicode, blocks formula text and keeps negative numbers numeric', () => {
  assert.equal(csvCell('café, "sales"\nline'), '"café, ""sales""\nline"')
  for (const value of ['=1+1', '+cmd', '@sum(A1)', '-cmd', '\t=1+1', '\n  =1+1']) assert.ok(csvCell(value).startsWith('"\''))
  assert.equal(csvCell(-12.5), '"-12.5"')
  assert.equal(csvCell(null), '""')
})

test('limits apply to actual bytes as well as content-length; malformed/HTML data stays private', async () => {
  for (const response of [
    new Response('bad json', { headers: { 'content-type': 'application/json' } }),
    new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('[]', { headers: { 'content-type': 'application/json', 'content-length': String(EXPORT_MAX_JSON_BYTES + 1) } }),
    new Response(' '.repeat(EXPORT_MAX_JSON_BYTES + 1), { headers: { 'content-type': 'application/json' } }),
  ]) {
    const result = await run(null, { query, response })
    assert.notEqual(result.status, 200)
    assert.equal(result.headers.get('content-disposition'), null)
    assert.equal(result.headers.get('cache-control'), 'private, no-store')
  }
})

test('upstream limits and adjusted-price refusals preserve status without leaking payloads', async () => {
  for (const status of [401, 403, 404, 409, 422, 429, 500, 503]) {
    const response = await run(null, { response: new Response('private upstream payload', { status, headers: { 'retry-after': '60' } }) })
    assert.equal(response.status, status === 500 ? 502 : status)
    assert.equal(response.headers.get('retry-after'), '60')
    assert.doesNotMatch(await response.text(), /private upstream payload/)
  }
})

test('transport failure does not turn into an empty or successful file', async () => {
  const response = await exportTicker(new Request(url + '?dataset=prices'), 'AAPL', {
    access: async () => ({ isSignedIn: true, isPro: true }), read: async () => { throw new Error('secret transport detail') },
  })
  assert.equal(response.status, 502)
  assert.doesNotMatch(await response.text(), /secret transport detail/)
})
