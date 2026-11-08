import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchBackendJson } from '../lib/backend'
import { getPickRanking, getPickRankingSummary } from '../lib/picks'
import { loadHomeBoardFor, resolvePicksFor } from '../lib/picks-resolution'
import { loadStockSummaryState } from '../lib/stock-summary-state'

/**
 * ENG-268 journey, homepage -> PFE -> AAPL, over the real loaders and the real fetchBackendJson,
 * against a stubbed backend that keeps a persistent per-visitor budget with the backend's rule:
 * a read that names a company spends the distinct-company budget (30 per hour for anonymous);
 * a list or the name-free summary never does. Every effective request is recorded.
 */
type Visit = { path: string }

function fakeBackend({ companyLimit = 30, preSpent = [] as string[] } = {}) {
  const requests: Visit[] = []
  const companies = new Set(preSpent)
  const fetcher = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    requests.push({ path: url.pathname + url.search })
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
    if (url.pathname === '/v1/screener/rankings/summary')
      return json({ asOf: '2026-11-06', readings: { longTerm: { ranked: 591 }, income: { ranked: 299 }, shortTerm: { ranked: 676 } } })
    if (url.pathname === '/v1/screener/rankings') {
      const reading = url.searchParams.get('reading') ?? 'x'
      return json({ items: Array.from({ length: 10 }, (_, n) => ({ position: n + 1, ticker: `${reading.toUpperCase()}${n}`, score: 90 - n })) })
    }
    const company = /^\/v1\/tickers\/([^/]+)\/summary$/.exec(url.pathname)
    if (company) {
      const ticker = decodeURIComponent(company[1])
      if (!companies.has(ticker) && companies.size >= companyLimit)
        return json({ detail: 'Market client budget exceeded' }, 429, { 'retry-after': '3600' })
      companies.add(ticker)
      return json({ ticker, name: ticker })
    }
    return json({ detail: 'not found' }, 404)
  }
  return { requests, companies, fetcher }
}

async function withBackend(backend: ReturnType<typeof fakeBackend>, run: () => Promise<void>) {
  const originalFetch = globalThis.fetch
  const keys = ['BACKEND_BASE_URL', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'VERCEL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']
  const original = keys.map((key) => process.env[key])
  keys.forEach((key) => { delete process.env[key] })
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  globalThis.fetch = backend.fetcher as typeof fetch
  try { await run() } finally {
    globalThis.fetch = originalFetch
    keys.forEach((key, i) => { if (original[i] === undefined) delete process.env[key]; else process.env[key] = original[i] })
  }
}

const loaders = { ranking: getPickRanking, summary: getPickRankingSummary }
const stockSummary = (ticker: string) => () =>
  fetchBackendJson<{ ticker: string }>(`/v1/tickers/${encodeURIComponent(ticker)}/summary`, { context: 'backend.tickers.summary' })
const rankingReads = (backend: ReturnType<typeof fakeBackend>) =>
  backend.requests.filter((r) => r.path.startsWith('/v1/screener/rankings?')).length
const summaryReads = (backend: ReturnType<typeof fakeBackend>) =>
  backend.requests.filter((r) => r.path === '/v1/screener/rankings/summary').length

for (const tier of ['anonymous', 'free'] as const) {
  test(`${tier}: homepage reads one summary and no hidden ranking, then PFE and AAPL open`, async () => {
    const backend = fakeBackend()
    await withBackend(backend, async () => {
      const board = await loadHomeBoardFor(tier, loaders)
      assert.equal(summaryReads(backend), 1, 'one name-free summary serves the three columns')
      assert.equal(rankingReads(backend), 0, 'no ranking the reader cannot see is read')
      for (const [reading, ranked] of [['longTerm', 591], ['income', 299], ['shortTerm', 676]] as const) {
        const column = board[reading]
        assert.equal(column.status, 'ok')
        if (column.status === 'ok') {
          assert.deepEqual(column.items, [], 'no name reaches the page')
          assert.equal(column.totalRanked, ranked)
        }
      }
      assert.equal(backend.companies.size, 0, 'the homepage spent nothing of the company budget')
      for (const ticker of ['PFE', 'AAPL']) {
        const state = await loadStockSummaryState(stockSummary(ticker), async () => tier === 'free')
        assert.equal(state.status, 'ok', `${ticker} opens`)
      }
      assert.deepEqual([...backend.companies], ['PFE', 'AAPL'])
    })
  })
}

test('pro: the visible ranking is still read and cut, without the summary', async () => {
  const backend = fakeBackend()
  await withBackend(backend, async () => {
    const board = await loadHomeBoardFor('pro', loaders)
    assert.equal(rankingReads(backend), 3)
    assert.equal(summaryReads(backend), 0)
    const column = board.longTerm
    assert.equal(column.status, 'ok')
    if (column.status === 'ok') assert.equal(column.items.length, 10)
  })
})

test('the old path would have spent the hour: thirty names before the first company page', async () => {
  // Control: reading the hidden rankings (what the old homepage did) is exactly what the gate prevents.
  const backend = fakeBackend()
  await withBackend(backend, async () => {
    const board = await loadHomeBoardFor('pro', loaders)
    const names = Object.values(board).flatMap((column) => (column.status === 'ok' ? column.items : []))
    assert.equal(new Set(names.map((item) => item.symbol)).size, 30)
    const anonymous = await resolvePicksFor('longTerm', 'anonymous', loaders)
    assert.ok(anonymous.status === 'ok' && anonymous.items.length === 0)
  })
})

for (const signedIn of [false, true]) {
  test(`a legitimately reached limit (${signedIn ? 'signed in' : 'anonymous'}) is a limit with its wait, read once`, async () => {
    const backend = fakeBackend({ preSpent: Array.from({ length: 30 }, (_, n) => `SEEN${n}`) })
    await withBackend(backend, async () => {
      await loadHomeBoardFor(signedIn ? 'free' : 'anonymous', loaders)
      assert.equal((await loadStockSummaryState(stockSummary('SEEN3'), async () => signedIn)).status, 'ok')
      const before = backend.requests.length
      const state = await loadStockSummaryState(stockSummary('AAPL'), async () => signedIn)
      assert.equal(backend.requests.length - before, 1, 'no automatic retry while the limit lasts')
      assert.equal(state.status, 'limit')
      if (state.status === 'limit') {
        assert.equal(state.signedIn, signedIn, 'the copy follows the real session')
        assert.equal(state.notice.minutes, 60, 'the wait comes from Retry-After')
      }
    })
  })
}

test('a failure that is not a limit stays a failure; a session lookup error reads as signed out', async () => {
  const backend = fakeBackend()
  await withBackend(backend, async () => {
    const missing = await loadStockSummaryState(
      () => fetchBackendJson('/v1/missing', { context: 'test' }), async () => true)
    assert.equal(missing.status, 'error')
  })
  const limited = await loadStockSummaryState(
    async () => { throw Object.assign(new Error('x'), { status: 429, retryAfter: '120' }) },
    async () => { throw new Error('clerk unavailable') })
  assert.ok(limited.status === 'limit' && limited.signedIn === false && limited.notice.minutes === 2)
})
