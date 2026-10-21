import assert from 'node:assert/strict'
import { test } from 'node:test'
import {randomBytes} from 'node:crypto'
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
  for (const baseUrl of ['http://api.example.com', `https://${randomBytes(8).toString('hex')}:${randomBytes(8).toString('hex')}@api.example.com`, 'https://api.example.com/path'])
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

test('browser native requests use the same-origin BFF with no origin credentials', async () => {
  const client=createPlatformClient({ baseUrl:'same-origin', getToken:async ()=>'synthetic-session',
    fetcher:async (url, options) => {
      assert.equal(url, '/api/platform/me')
      assert.deepEqual(options?.headers, { Authorization:'Bearer synthetic-session' })
      return new Response('{}')
    } })
  await client('/me')
})

test('server native requests add origin transport separately from the session', async () => {
  const client=createPlatformClient({ baseUrl:'https://backend.example.test', getToken:async ()=>'synthetic-session',
    originHeaders:async (url, method) => {
      assert.equal(url.pathname, '/v1/me'); assert.equal(method, 'GET')
      return { 'CF-Access-Client-Id':'synthetic-access-id', 'CF-Access-Client-Secret':'synthetic-access-secret' }
    }, fetcher:async (_url, options) => {
      assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer synthetic-session')
      assert.equal(new Headers(options?.headers).get('CF-Access-Client-Id'), 'synthetic-access-id')
      return new Response('{}')
    } })
  await client('/me')
})

test('the Model Lab routes are a closed list and runs need an idempotency key', async () => {
  const id = '3f2b8c1e-6d4a-4b7e-9c10-2a5d7e8f9b01'
  const seen: string[] = []
  const client = createPlatformClient({ baseUrl: 'https://api.example.com', getToken: async () => 'fixture',
    fetcher: async (url, options) => { seen.push(`${options?.method} ${url}`); return new Response('{}') } })
  for (const path of ['/model-lab/viewer', '/model-lab/theses', `/model-lab/theses/${id}`, `/model-lab/theses/${id}/evidence`,
    `/model-lab/tests/${id}/results`, `/model-lab/runs/${id}`, '/model-lab/panels', `/model-lab/panels/${id}/today`,
    `/model-lab/panels/${id}/evidence`, `/model-lab/panels/${id}/alerts`, '/model-lab/library', '/model-lab/alerts',
    '/model-lab/admin/queue', '/model-lab/admin/pipeline/panel', '/model-lab/admin/access-requests', '/model-lab/admin/data-health'])
    await client(`${path}?account_id=${id}`)
  assert.equal(seen.length, 16)
  await client('/model-lab/quotes', { method: 'POST', body: {} })
  await client('/model-lab/runs', { method: 'POST', body: {}, idempotencyKey: 'run-fixture-1' })
  await client(`/model-lab/runs/${id}/cancel`, { method: 'POST', body: {} })
  await client(`/model-lab/theses/${id}/notes`, { method: 'POST', body: {} })
  await client(`/model-lab/panels/${id}`, { method: 'PATCH', body: {} })
  await client(`/model-lab/theses/${id}/watch`, { method: 'PATCH', body: {} })
  await assert.rejects(client('/model-lab/runs', { method: 'POST', body: {} }), PlatformError)
})

test('Model Lab paths outside the closed list never fetch', async () => {
  const id = '3f2b8c1e-6d4a-4b7e-9c10-2a5d7e8f9b01'
  const client = createPlatformClient({ baseUrl: 'https://api.example.com', getToken: async () => 'fixture',
    fetcher: async () => { throw Error('must not fetch') } })
  for (const path of ['/model-lab', '/model-lab/theses/not-a-uuid', `/model-lab/theses/${id}/other`, '/model-lab/admin/users',
    '/model-lab/admin/pipeline/secret', `/model-lab/runs/${id}/results`, '/model-lab/theses/../me', '/model-lab/panels/%2e%2e'])
    await assert.rejects(client(path), PlatformError)
  await assert.rejects(client(`/model-lab/theses/${id}`, { method: 'DELETE' }), PlatformError)
  await assert.rejects(client(`/model-lab/theses/${id}`, { method: 'PATCH', body: {} }), PlatformError)
})
