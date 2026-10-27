import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendDataError, fetchBackendJson } from '../lib/backend'

async function withBackend(run: () => Promise<void>) {
  const originalFetch = globalThis.fetch
  const keys = ['BACKEND_BASE_URL', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'VERCEL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']
  const original = keys.map(key => process.env[key])
  keys.forEach(key => { delete process.env[key] }); process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  try { await run() } finally {
    globalThis.fetch = originalFetch
    keys.forEach((key, i) => { if (original[i] === undefined) delete process.env[key]; else process.env[key] = original[i] })
  }
}

test('backend deadline aborts the actual request, once, and preserves no-store', async () => withBackend(async () => {
  let calls = 0; let cancelled = false
  globalThis.fetch = async (_url, init) => {
    calls++; assert.equal(init?.cache, 'no-store')
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { cancelled = true; reject(init.signal?.reason) }, { once: true })
    })
  }
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(fetchBackendJson('/v1/tickers/AAPL/summary', { context: 'test', timeoutMs: 15 }),
      (error: unknown) => error instanceof BackendDataError && error.status === 503)
    assert.equal(cancelled, true); assert.equal(calls, 1)
  } finally { clearTimeout(keepAlive) }
}))

test('caller cancellation is forwarded without a second request', async () => withBackend(async () => {
  const caller = new AbortController(); let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++; assert.ok(init?.signal)
    caller.abort(new Error('navigation cancelled'))
    init.signal.throwIfAborted(); throw Error('unreachable')
  }
  await assert.rejects(fetchBackendJson('/v1/tickers/AAPL/summary', { context: 'test', init: { signal: caller.signal } }), /navigation cancelled/)
  assert.equal(calls, 1)
}))

test('backend throttling and unavailability never repeat on the server', async () => withBackend(async () => {
  for (const status of [429, 503]) {
    let calls = 0
    globalThis.fetch = async () => { calls++; return new Response('{}', { status }) }
    await assert.rejects(fetchBackendJson('/v1/tickers/AAPL/summary', { context: 'test' }),
      (error: unknown) => error instanceof BackendDataError && error.status === status)
    assert.equal(calls, 1)
  }
}))


test('deadline also cancels a stalled response body after headers arrive', async () => withBackend(async () => {
  let cancelled = false
  globalThis.fetch = async (_url, init) => new Response(new ReadableStream({ start(controller) {
    init?.signal?.addEventListener('abort', () => { cancelled = true; controller.error(init.signal?.reason) }, { once: true })
  } }))
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(fetchBackendJson('/v1/tickers/AAPL/summary', { context: 'test', timeoutMs: 15 }),
      (error: unknown) => error instanceof BackendDataError && error.status === 503)
    assert.equal(cancelled, true)
  } finally { clearTimeout(keepAlive) }
}))
