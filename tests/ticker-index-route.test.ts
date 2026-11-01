import assert from 'node:assert/strict'
import test from 'node:test'
import { GET } from '../app/api/tickers/index/route'
import { proxyTickerIndex } from '../lib/ticker-index-proxy'

function preserveEnv() {
  const original = {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    BACKEND_BASE_URL: process.env.BACKEND_BASE_URL,
    BACKEND_SHARED_SECRET: process.env.BACKEND_SHARED_SECRET,
    CF_ACCESS_CLIENT_ID: process.env.CF_ACCESS_CLIENT_ID,
    CF_ACCESS_CLIENT_SECRET: process.env.CF_ACCESS_CLIENT_SECRET,
    FINANCE_BACKEND_URL: process.env.FINANCE_BACKEND_URL,
  }

  // This unit case is explicitly anonymous, without a Next.js request context.
  // Real configured sessions and the BFF are exercised by qa:local.
  delete process.env.CLERK_SECRET_KEY
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

test('ticker index route uses /v1 and Access without forwarding an obsolete shared secret', async () => {
  const restoreEnv = preserveEnv()
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'https://backend.example.test/'
  delete process.env.FINANCE_BACKEND_URL
  process.env.BACKEND_SHARED_SECRET = 'shared-secret'
  process.env.CF_ACCESS_CLIENT_ID = 'cf-client-id'
  process.env.CF_ACCESS_CLIENT_SECRET = 'cf-client-secret'

  let requestedUrl = ''
  let requestedHeaders: Headers | null = null
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input)
    requestedHeaders = new Headers(init?.headers)
    return new Response(
      JSON.stringify({
        items: [
          { symbol: 'GME', name: 'GameStop Corp.', exchange: null, hasSignals: false },
        ],
      }),
      {
        status: 200,
        headers: {
          'cache-control': 'public, max-age=3600',
          'content-type': 'application/json',
          etag: '"ticker-index-v1"',
        },
      }
    )
  }

  try {
    const response = await GET(
      new Request('https://site.example.test/api/tickers/index', {
        headers: { 'if-none-match': '"previous"' },
      })
    )
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('etag'), '"ticker-index-v1"')
    assert.deepEqual(payload.items.map((item: { symbol: string }) => item.symbol), ['GME'])
    assert.equal(requestedUrl, 'https://backend.example.test/v1/tickers/index')
    assert.ok(requestedHeaders)
    assert.equal(requestedHeaders.get('accept'), 'application/json')
    assert.equal(requestedHeaders.get('x-backend-shared-secret'), null)
    assert.equal(requestedHeaders.get('Authorization'), null)
    assert.equal(requestedHeaders.get('CF-Access-Client-Id'), 'cf-client-id')
    assert.equal(requestedHeaders.get('CF-Access-Client-Secret'), 'cf-client-secret')
    assert.equal(requestedHeaders.get('If-None-Match'), '"previous"')
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
})

test('ticker index route surfaces Cloudflare Access upstream denials', async () => {
  const restoreEnv = preserveEnv()
  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error

  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  delete process.env.FINANCE_BACKEND_URL
  process.env.BACKEND_SHARED_SECRET = 'shared-secret'
  delete process.env.CF_ACCESS_CLIENT_ID
  delete process.env.CF_ACCESS_CLIENT_SECRET

  const logs: unknown[][] = []
  console.error = (...args: unknown[]) => {
    logs.push(args)
  }
  globalThis.fetch = async () =>
    new Response('<!DOCTYPE html><title>Error - Cloudflare Access</title>', {
      status: 403,
      headers: {
        'cf-access-domain': 'backend.example.test',
        'content-type': 'text/html',
      },
    })

  try {
    const response = await GET(new Request('https://site.example.test/api/tickers/index'))
    const payload = await response.json()

    assert.equal(response.status, 502)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(payload.error, 'backend_access_denied')
    assert.equal(payload.status, 403)
    assert.equal(payload.cfAccessDomain, 'backend.example.test')
    assert.equal(logs.length, 1)
    assert.match(String(logs[0]?.[0]), /upstream unavailable/)
    assert.equal((logs[0]?.[1] as { hasCfAccessClientId?: boolean }).hasCfAccessClientId, false)
  } finally {
    console.error = originalConsoleError
    globalThis.fetch = originalFetch
    restoreEnv()
  }
})

test('ticker index preserves admission refusals and retry delay without exposing upstream bodies', async () => {
  const restoreEnv = preserveEnv()
  const originalFetch = globalThis.fetch
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  try {
    for (const status of [401, 403, 429, 503]) {
      globalThis.fetch = async () => new Response('private upstream diagnostic', {
        status, headers: { 'retry-after': '30', 'cache-control': 'public, max-age=3600' },
      })
      const response = await GET(new Request('https://site.example.test/api/tickers/index'))
      assert.equal(response.status, status)
      assert.equal(response.headers.get('retry-after'), '30')
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.doesNotMatch(await response.text(), /private upstream diagnostic/)
    }
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
})

test('ticker index revalidation cannot make a public cached response bypass admission', async () => {
  const restoreEnv = preserveEnv()
  const originalFetch = globalThis.fetch
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  let requests = 0
  globalThis.fetch = async () => {
    requests++
    return new Response(null, { status: 304, headers: {
      etag: '"catalogue"', 'cache-control': 'public, max-age=3600',
    } })
  }
  try {
    for (let i = 0; i < 2; i++) {
      const response = await GET(new Request('https://site.example.test/api/tickers/index', {
        headers: { 'if-none-match': '"catalogue"' },
      }))
      assert.equal(response.status, 304)
      assert.equal(response.headers.get('etag'), '"catalogue"')
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
    }
    assert.equal(requests, 2)
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
})

test('ticker index deadline cancels an upstream request that never returns', async () => {
  const restoreEnv = preserveEnv()
  const originalFetch = globalThis.fetch
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  let cancelled = false
  let requests = 0
  globalThis.fetch = async (_url, init) => {
    requests++
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        cancelled = true
        reject(init.signal?.reason)
      }, { once: true })
    })
  }
  try {
    const response = await proxyTickerIndex(new Request('https://site.example.test/api/tickers/index'), 20)
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('retry-after'), '30')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(cancelled, true)
    assert.equal(requests, 1)
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
})

test('ticker index deadline also covers a stalled response body', async () => {
  const restoreEnv = preserveEnv()
  const originalFetch = globalThis.fetch
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  let cancelled = false
  globalThis.fetch = async (_url, init) => new Response(new ReadableStream({ start(controller) {
    init?.signal?.addEventListener('abort', () => {
      cancelled = true
      controller.error(init.signal?.reason)
    }, { once: true })
  } }))
  try {
    const response = await proxyTickerIndex(new Request('https://site.example.test/api/tickers/index'), 20)
    assert.equal(response.status, 503)
    assert.equal(cancelled, true)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
})
