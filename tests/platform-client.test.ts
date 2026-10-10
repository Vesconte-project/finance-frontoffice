import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPlatformClient, PlatformError } from '../lib/platform-client'

test('native requests contain only a fresh session token and omit cookies', async () => {
  let count = 0
  const client = createPlatformClient({ baseUrl: 'http://127.0.0.1:18095', getToken: async () => `fresh-${++count}`,
    fetcher: async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:18095/v1/me')
      assert.equal(options?.credentials, 'omit')
      assert.equal(options?.cache, 'no-store')
      assert.equal(options?.redirect, 'error')
      assert.deepEqual(options?.headers, { Authorization: `Bearer fresh-${count}` })
      return new Response('{}')
    } })
  await client('/me'); await client('/me')
  assert.equal(count, 2)
})

test('401 refreshes once; no BFF or service-token fallback', async () => {
  const refresh: unknown[] = []
  let requests = 0
  const client = createPlatformClient({ baseUrl: 'https://api.example.com', getToken: async options => {
    refresh.push(options); return 'session-fixture'
  }, fetcher: async () => { requests++; return new Response('{}', { status: 401 }) } })
  await assert.rejects(client('/me'), (error: unknown) => error instanceof PlatformError && error.status === 401)
  assert.equal(requests, 2)
  assert.deepEqual(refresh, [undefined, { skipCache: true }])
})

test('idempotency key survives session refresh without automatic network retry', async () => {
  let calls = 0
  const client = createPlatformClient({ baseUrl: 'https://api.example.com', getToken: async () => 'fixture',
    fetcher: async (_url, options) => {
      calls++
      assert.equal((options?.headers as Record<string, string>)['Idempotency-Key'], 'checkout-fixture')
      assert.equal(options?.body, '{"account_id":"fixture"}')
      return new Response('{}', { status: calls === 1 ? 401 : 200 })
    } })
  await client('/billing/checkout', { method: 'POST', body: { account_id: 'fixture' }, idempotencyKey: 'checkout-fixture' })
  assert.equal(calls, 2)
})

test('unsafe bases, unsupported routes and missing idempotency never fetch', async () => {
  for (const baseUrl of ['http://api.example.com', 'https://user:password@api.example.com', 'https://api.example.com/path'])
    assert.throws(() => createPlatformClient({ baseUrl, getToken: async () => 'fixture' }), PlatformError)
  const client = createPlatformClient({ baseUrl: 'https://api.example.com', getToken: async () => 'fixture',
    fetcher: async () => { throw Error('must not fetch') } })
  for (const path of ['//other.example.com/me', '/webhooks/stripe', '/admin/me', '/me#fragment', '/me%2fother'])
    await assert.rejects(client(path), PlatformError)
  await assert.rejects(client('/research/jobs', { method: 'POST', body: {} }), PlatformError)
})

test('quota errors preserve safe Retry-After without provider response details', async () => {
  const client = createPlatformClient({ baseUrl: 'https://api.example.com', getToken: async () => 'fixture',
    fetcher: async () => new Response('private-provider-details', { status: 429, headers: { 'Retry-After': '45' } }) })
  await assert.rejects(client('/me'), (error: unknown) => error instanceof PlatformError &&
    error.retryAfter === 45 && !error.message.includes('private-provider'))
})
