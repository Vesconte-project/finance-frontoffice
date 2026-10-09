import assert from 'node:assert/strict'
import test from 'node:test'
import { createResearchClient, ResearchReadError } from '../lib/synthetic-research-client'
const baseUrl = 'http://127.0.0.1:18095'
const ok = () => Response.json({ jobs: [] })
test('BFF remains default and retains only same-origin cookies', async () => {
  const client = createResearchClient({ getToken: async () => { throw Error('BFF must not mint a token') }, fetcher: async (url, init) => {
    assert.equal(url, '/api/research/synthetic/experiments?limit=50')
    assert.equal(init?.credentials, 'same-origin')
    assert.equal(new Headers(init?.headers).has('Authorization'), false)
    return ok()
  } })
  assert.deepEqual(await client('experiments?limit=50'), { jobs: [] })
})
test('direct requests obtain tokens per request, omit cookies and secrets', async () => {
  let tokens = 0
  const client = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => `token-${++tokens}`, fetcher: async (url, init) => {
    assert.equal(url, `${baseUrl}/site/research/synthetic/experiments`)
    assert.equal(init?.credentials, 'omit')
    assert.equal(init?.redirect, 'error')
    assert.deepEqual(Object.fromEntries(new Headers(init?.headers)), { authorization: `Bearer token-${tokens}`, 'content-type': 'application/json' })
    return ok()
  } })
  await client('experiments'); await client('experiments'); assert.equal(tokens, 2)
})
test('401 forces one new session token then asks for login, without BFF fallback', async () => {
  const options: unknown[] = []; let calls = 0
  const client = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async o => { options.push(o); return 'session' }, fetcher: async url => {
    assert.ok(String(url).startsWith(baseUrl)); calls++; return new Response('', { status: 401 })
  } })
  await assert.rejects(client('experiments'), (e: unknown) => e instanceof ResearchReadError && e.status === 401)
  assert.deepEqual(options, [undefined, { skipCache: true }]); assert.equal(calls, 2)
})
test('refresh can recover and null session never reaches the network', async () => {
  let calls = 0
  const client = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => 'session', fetcher: async () => ++calls === 1 ? new Response('', { status: 401 }) : ok() })
  assert.deepEqual(await client('experiments'), { jobs: [] }); assert.equal(calls, 2)
  const absent = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => null, fetcher: async () => { throw Error('Unexpected request') } })
  await assert.rejects(absent('experiments'), (e: unknown) => e instanceof ResearchReadError && e.status === 401)
})
for (const status of [403, 404, 422, 503]) test(`status ${status} is preserved without retry or invented data`, async () => {
  let calls = 0
  const client = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => 'session', fetcher: async () => { calls++; return new Response('non-JSON error', { status }) } })
  await assert.rejects(client('experiments'), (e: unknown) => e instanceof ResearchReadError && e.status === status); assert.equal(calls, 1)
})
test('unknown mode, unsafe base and path fail closed before token retrieval', async () => {
  for (const options of [{ mode: 'typo', baseUrl }, { mode: 'clerk_jwt', baseUrl: '' }, { mode: 'clerk_jwt', baseUrl: 'http://remote.example' }, { mode: 'clerk_jwt', baseUrl: 'https://u:p@example.com' }]) {
    const client = createResearchClient({ ...options, getToken: async () => { throw Error('Unexpected token') } })
    await assert.rejects(client('experiments'), (e: unknown) => e instanceof ResearchReadError && e.status === 503)
  }
  await assert.rejects(createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => 'session' })('../outside'), (e: unknown) => e instanceof ResearchReadError && e.status === 404)
})
test('malformed successful response fails without inventing data', async () => {
  const client = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => 'session', fetcher: async () => Response.json({ jobs: 'fake' }) })
  await assert.rejects(client('experiments'), (e: unknown) => e instanceof ResearchReadError && e.status === 502)
})

test('comparison POST preserves the request and accepted response; network failures never resubmit', async () => {
  const body = { experiment_name: 'unit_comparison', fixture: 'synthetic-market-v1' as const,
    variants: [{ name: 'baseline', model: 'logistic_regression' as const, probability_threshold: 0.5 as const },
      { name: 'forest', model: 'random_forest_classifier' as const, probability_threshold: 0.6 as const }] as import('../lib/synthetic-research').ComparisonRequest['variants'] }
  let calls = 0
  const client = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => 'session', fetcher: async (url, init) => {
    calls++
    assert.equal(url, `${baseUrl}/site/research/synthetic/comparisons`)
    assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), body)
    return Response.json({ status: 'queued', members: [{ variant: 'baseline', experiment_id: 'job_1', status: 'queued', definition_hash: null, config_hash: null }] }, { status: 202 })
  } })
  assert.equal((await client('comparisons', body)).status, 'queued'); assert.equal(calls, 1)
  const failure = createResearchClient({ mode: 'clerk_jwt', baseUrl, getToken: async () => 'session', fetcher: async () => { calls++; throw Error('Disconnected') } })
  await assert.rejects(failure('comparisons', body), /outcome is unknown/); assert.equal(calls, 2)
})
