import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as React from 'react'
import * as JSXRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

function load(file, imports, env, fetch) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  runInNewContext(code, { exports, process: { env }, fetch, AbortSignal, TextEncoder, TextDecoder,
    URL, URLSearchParams, Response, Request, ReadableStream, Date,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`); return imports[name] },
  }, { filename: file })
  return exports
}

function setup(options = {}) {
  const account = randomUUID(), user = randomUUID(), runId = randomUUID()
  const token = randomBytes(32).toString('base64url')
  const env = { NEXT_PUBLIC_PLATFORM_API_ENABLED: 'true',
    BACKEND_BASE_URL: 'https://backend.example.invalid',
    PERPLEXITY_API_KEY: randomUUID(), ...options.env }
  const calls = [], logs = []
  const fetch = async (url, init) => {
    calls.push({ url, init })
    if (url === 'https://api.perplexity.ai/chat/completions') {
      assert.ok(calls.some(call => new URL(call.url).pathname === '/v1/ai-research/runs'))
      return new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    }
    const parsed = new URL(url)
    assert.ok(parsed.pathname.startsWith('/v1/'), 'No legacy shared-secret fallback')
    assert.equal(init.headers.Authorization, 'Bearer '+token)
    assert.equal(init.headers['x-backend-shared-secret'], undefined)
    assert.equal(init.cache, 'no-store')
    assert.equal(init.redirect, 'error')
    if (parsed.pathname === '/v1/me') return Response.json({ user: { id: user }, accounts: [{
      id: account, type: options.org ? 'organization' : 'personal', status: 'active', role: 'member',
      clerk_organization_id: options.wrongOrg ? 'org_wrong0001' : options.org || null }] })
    assert.equal(parsed.searchParams.get('account_id'), account)
    if (options.reject) return Response.json({ detail: 'private upstream text' },
      { status: options.reject, headers: { 'Retry-After': '17' } })
    if (init.body) {
      const body = JSON.parse(init.body)
      for (const key of ['userId', 'user_id', 'owner_user_id', 'anonymous_id', 'session_id']) assert.equal(body[key], undefined)
    }
    if (parsed.pathname === '/v1/ai-research/runs') return Response.json(init.method === 'GET' ? { runs: [] } : { runId })
    return Response.json(parsed.pathname === '/v1/watchlist' && init.method === 'GET' ? { tickers: ['SYNTH'] } : { ok: true })
  }
  const platform = load('lib/platform-client.ts', {}, env, fetch)
  const session = load('lib/platform-server.ts', { 'server-only': {}, './platform-client': platform, './backend-origin': {backendOriginHeaders:async()=>({})},
    '@clerk/nextjs/server': { auth: async () => ({ userId: options.anonymous ? null : 'user_synthetic001',
      orgId: options.org, getToken: async () => options.anonymous ? null : token }) } }, env, fetch)
  const personal = load('lib/personal-server.ts', { 'server-only': {}, './platform-server': session,
    './platform-client': platform }, env, fetch)
  const watchlist = load('lib/watchlist.ts', { 'server-only': {}, './personal-server': personal }, env, fetch)
  const research = load('lib/ai-research.ts', { 'server-only': {}, './personal-server': personal }, env, fetch)
  const next = { NextResponse: class extends Response { static json(body, init) { return Response.json(body, init) } } }
  const auth = { getViewerUserId: async () => options.anonymous ? null : 'user_synthetic001' }
  const imports = { 'next/server': next, '@/lib/auth': auth, '@/lib/personal-server': personal }
  const watch = load('app/api/watchlist/route.ts', { ...imports, '@/lib/watchlist': watchlist }, env, fetch)
  const ai = load('app/api/ai-analyst/route.ts', { ...imports, '@/lib/ai-research': research }, env, fetch)
  const feedback = load('app/api/ai-analyst/feedback/route.ts', { ...imports, '@/lib/ai-research': research }, env, fetch)
  const ingest = load('lib/analytics-ingest.ts', {}, env, fetch)
  const analytics = load('app/api/analytics/event/route.ts', { ...imports, '@/lib/analytics-ingest': ingest,
    '@/lib/observability/vercel-log': { logServerEvent: (...args) => logs.push(args), logTelemetryEvent: event => logs.push(event) } }, env, fetch)
  const request = body => new Request('https://example.invalid/api/test', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { calls, logs, account, runId, watch, watchlist, ai, feedback, analytics, research, request }
}

test('watchlist BFF uses the verified active account and sends no owner', async () => {
  const c = setup({ org: 'org_synthetic001' })
  assert.equal((await c.watch.POST(c.request({ ticker: 'synth' }))).status, 200)
  assert.equal((await c.watch.DELETE(c.request({ ticker: 'SYNTH' }))).status, 200)
  assert.deepEqual(Array.from(await c.watchlist.getUserWatchlistTickers()), ['SYNTH'])
  assert.equal(c.calls.filter(call => new URL(call.url).pathname === '/v1/watchlist').length, 3)
})

test('signed out, supplied owner and wrong organization cannot mutate watchlist', async () => {
  const anonymous = setup({ anonymous: true })
  assert.equal((await anonymous.watch.POST(anonymous.request({ ticker: 'SYNTH' }))).status, 401)
  assert.equal(anonymous.calls.length, 0)
  const forged = setup()
  assert.equal((await forged.watch.POST(forged.request({ ticker: 'SYNTH', userId: randomUUID() }))).status, 400)
  assert.equal(forged.calls.length, 0)
  const wrong = setup({ org: 'org_synthetic001', wrongOrg: true })
  assert.equal((await wrong.watch.POST(wrong.request({ ticker: 'SYNTH' }))).status, 404)
  assert.equal(wrong.calls.length, 1)
})

test('disabled platform is unavailable, with no fallback', async () => {
  const c = setup({ env: { NEXT_PUBLIC_PLATFORM_API_ENABLED: 'false' } })
  const result = await c.watch.POST(c.request({ ticker: 'SYNTH' }))
  assert.equal(result.status, 503)
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(c.calls.length, 0)
})

test('security denials preserve status and Retry-After without upstream details', async () => {
  for (const reject of [403, 404, 429, 503]) {
    const c = setup({ reject })
    const result = await c.watch.POST(c.request({ ticker: 'SYNTH' }))
    assert.equal(result.status, reject)
    assert.equal(result.headers.get('Retry-After'), '17')
    assert.ok(!(await result.text()).includes('private upstream text'))
  }
})

const aiBody = { ticker: 'SYNTH', signal: { direction: 'neutral' } }
test('anonymous AI never reserves or calls the provider', async () => {
  const c = setup({ anonymous: true })
  assert.equal((await c.ai.POST(c.request(aiBody))).status, 401)
  assert.equal(c.calls.length, 0)
})

test('AI authorization failure never calls the provider', async () => {
  for (const reject of [403, 429, 503]) {
    const c = setup({ reject })
    assert.equal((await c.ai.POST(c.request(aiBody))).status, reject)
    assert.ok(c.calls.every(call => new URL(call.url).host === 'backend.example.invalid'))
  }
})

test('AI creates an owner-free UUID run before generation and finalizes that run', async () => {
  const c = setup()
  const result = await c.ai.POST(c.request(aiBody))
  assert.equal(result.status, 200)
  assert.ok((await result.text()).includes(c.runId))
  const patch = c.calls.find(call => call.init.method === 'PATCH')
  assert.ok(patch)
  assert.equal(new URL(patch.url).pathname, '/v1/ai-research/runs/'+c.runId)
  assert.equal(JSON.parse(patch.init.body).runId, undefined)
})

test('feedback requires a concrete UUID run and preserves backend ownership denial', async () => {
  const c = setup({ reject: 404 })
  assert.equal((await c.feedback.POST(c.request({ category: 'quality' }))).status, 400)
  assert.equal((await c.feedback.POST(c.request({ runId: c.runId, category: 'quality' }))).status, 404)
  assert.equal((await c.feedback.POST(c.request({ runId: c.runId, category: 'quality', userId: randomUUID() }))).status, 400)
})

test('anonymous analytics stay in frontend telemetry and never reach the backend', async () => {
  const c = setup({ anonymous: true })
  assert.equal((await c.analytics.POST(c.request({ event_name: 'synthetic_click', pathname: '/' }))).status, 204)
  assert.equal(c.calls.length, 0)
  assert.equal(c.logs.length, 1)
  assert.equal(c.logs[0].viewerId, null)
})

test('authenticated analytics use /v1 and fail open only for frontend telemetry', async () => {
  for (const reject of [undefined, 503]) {
    const c = setup({ reject })
    assert.equal((await c.analytics.POST(c.request({ event_name: 'synthetic_click', pathname: '/dashboard',
      anonymous_id: 'frontend-only', session_id: 'frontend-only' }))).status, 204)
    assert.ok(c.calls.some(call => new URL(call.url).pathname === '/v1/analytics/events'))
    assert.equal(c.logs[0].eventName, 'synthetic_click')
  }
})

test('failed watchlist read renders an explicit unavailable state, without guessing membership', async () => {
  const c = setup({ reject: 503 })
  const chrome = load('lib/stock-ticker-chrome.ts', { 'server-only': {},
    '@/lib/auth': { getViewerUserId: async () => 'user_synthetic001' },
    '@/lib/currency': { currencyForTicker: () => 'USD' },
    '@/lib/stock-asset-kind': { resolveStockAsset: () => ({ badge: 'Equity' }) },
    '@/lib/ticker-data': { getTickerPageSummary: async () => null },
    '@/lib/ticker-identity-color': { tickerIdentityColor: () => '#000000' },
    '@/lib/watchlist': c.watchlist,
  }, {}, () => { throw Error('Unexpected request') })
  const data = await chrome.getStockTickerChromeData('SYNTH')
  assert.equal(data.watchlist.unavailable, true)
  const button = load('components/WatchlistButton.tsx', {
    'react': React, 'react/jsx-runtime': JSXRuntime, 'next/link': () => null,
    'lucide-react': { Loader2: () => null, RotateCcw: () => null, Star: () => null },
    '@/components/ui/Button': { buttonClass: () => '' }, '@/lib/utils': { cn: (...args) => args.join(' ') },
    '@/components/ui/Dialog': () => null, '@/components/ui/PromptPanel': () => null,
  }, {}, () => { throw Error('Unavailable state must not mutate') })
  const html = renderToStaticMarkup(React.createElement(button.default,
    { ticker: data.ticker, ...data.watchlist }))
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-label="Watchlist temporarily unavailable"/)
  assert.match(html, /role="status">Watchlist unavailable/)
  assert.ok(!html.includes('aria-pressed='))
})

test('anonymous telemetry ingress survives missing Clerk configuration', () => {
  let clerkCalls = 0
  const proxy = load('proxy.ts', {
    '@clerk/nextjs/server': { createRouteMatcher: () => () => false,
      clerkMiddleware: () => () => { clerkCalls++; return new Response(null, { status: 204 }) } },
    'next/server': { NextResponse: { next: () => new Response(null, { status: 204 }) } },
  }, {}, () => { throw Error('No upstream request') })
  assert.equal(proxy.default({ nextUrl: { pathname: '/api/analytics/event' }, headers: new Headers(), cookies: { getAll: () => [] } }).status, 204)
  assert.equal(clerkCalls, 0)
})


test('personal ticker filters support the V6 ticker alphabet through encoded query values', async () => {
  const c = setup()
  await c.research.getRecentAiResearchRuns({ ticker: '^SYNTH=F' })
  const call = c.calls.find(call => new URL(call.url).pathname === '/v1/ai-research/runs')
  assert.equal(new URL(call.url).searchParams.get('ticker'), '^SYNTH=F')
})


test('anonymous telemetry does not depend on Clerk even when the integration is configured', () => {
  let clerkCalls = 0
  const proxy = load('proxy.ts', {
    '@clerk/nextjs/server': { createRouteMatcher: () => () => false,
      clerkMiddleware: () => () => { clerkCalls++; return new Response(null, { status: 204 }) } },
    'next/server': { NextResponse: { next: () => new Response(null, { status: 204 }) } },
  }, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: randomUUID(), CLERK_SECRET_KEY: randomUUID() },
  () => { throw Error('No upstream request') })
  const request = { nextUrl: { pathname: '/api/analytics/event' }, headers: new Headers(), cookies: { getAll: () => [] } }
  assert.equal(proxy.default(request).status, 204)
  assert.equal(clerkCalls, 0)
  proxy.default({ ...request, cookies: { getAll: () => [{ name: '__session_fixture', value: randomUUID() }] } })
  assert.equal(clerkCalls, 1, 'A presented credential must be passed to the actual verifier')
})
