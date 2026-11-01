import assert from 'node:assert/strict'
import test from 'node:test'
import { retryAfterMs, retryDelayMs } from '../lib/retry-policy'
import { createReadClient } from '../lib/read-client'

test('Retry-After parses seconds, dates, expired dates and invalid values', () => {
  const now = Date.parse('Mon, 26 Oct 2026 23:00:00 GMT')
  assert.equal(retryAfterMs('60', now), 60000)
  assert.equal(retryAfterMs('Mon, 26 Oct 2026 23:01:00 GMT', now), 60000)
  assert.equal(retryAfterMs('Mon, 26 Oct 2026 22:00:00 GMT', now), 0)
  for (const invalid of [null, '', '-1', '1.5', 'Infinity', 'tomorrow', '99999999999999999']) assert.equal(retryAfterMs(invalid, now), null)
})

test('backoff always pauses, grows exponentially and adds jitter after Retry-After', () => {
  assert.equal(retryDelayMs(0, null, 0, () => 0), 1000)
  assert.equal(retryDelayMs(1, null, 0, () => 0.5), 3000)
  assert.equal(retryDelayMs(0, '10', 0, () => 0.5), 10500)
  assert.equal(retryDelayMs(0, '0', 0, () => 0), 1000)
})

test('SSR never repeats 429 or 503', async () => {
  for (const status of [429, 503]) {
    let calls = 0
    const read = createReadClient({ runtime: 'server', fetcher: async () => { calls++; return new Response('', { status }) }, wait: async () => { assert.fail('SSR waited to retry') } })
    assert.equal((await read('/api/fixture')).status, status)
    assert.equal(calls, 1)
  }
})

test('browser retries at most twice, and each retry follows a completed pause', async () => {
  const events: string[] = []
  const read = createReadClient({ runtime: 'browser', random: () => 0, fetcher: async () => {
    events.push('fetch'); return new Response('', { status: 429, headers: { 'Retry-After': '2' } })
  }, wait: async ms => { events.push(`wait:${ms}`) } })
  assert.equal((await read('/api/fixture')).status, 429)
  assert.deepEqual(events, ['fetch', 'wait:2000', 'fetch', 'wait:2000', 'fetch'])
})

test('successful browser read is fetched once; concurrent identical reads share independent bodies', async () => {
  let calls = 0
  const read = createReadClient({ runtime: 'browser', fetcher: async () => { calls++; return new Response('{"ok":true}') } })
  const [a, b] = await Promise.all([read('/api/fixture'), read('/api/fixture')])
  assert.equal(calls, 1)
  assert.deepEqual(await a.json(), { ok: true }); assert.deepEqual(await b.json(), { ok: true })
  await read('/api/fixture'); assert.equal(calls, 2) // no cross-request response cache
})

test('HTTP-date is respected; hour/day limits do not leave an automatic retry timer', async () => {
  let calls = 0
  const read = createReadClient({ runtime: 'browser', now: () => Date.parse('Mon, 26 Oct 2026 23:00:00 GMT'),
    fetcher: async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': 'Mon, 26 Oct 2026 23:01:00 GMT' } }) },
    wait: async () => assert.fail('long refusal must be presented to the user') })
  assert.equal((await read('/api/fixture')).status, 429); assert.equal(calls, 1)
})

test('mutations, forbidden responses and network failures are never replayed', async () => {
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    let calls = 0
    const read = createReadClient({ runtime: 'browser', fetcher: async () => { calls++; return new Response('', { status: 503 }) } })
    await read('/api/fixture', { method }); assert.equal(calls, 1)
  }
  let calls = 0
  const read = createReadClient({ runtime: 'browser', fetcher: async () => { calls++; throw new Error('offline') } })
  await assert.rejects(read('/api/fixture'), /offline/); assert.equal(calls, 1)
})

test('cancelling a paused request prevents its next attempt', async () => {
  const controller = new AbortController()
  let calls = 0
  const read = createReadClient({ runtime: 'browser', fetcher: async () => { calls++; return new Response('', { status: 503 }) },
    wait: async () => { controller.abort() } })
  await assert.rejects(read('/api/fixture', { signal: controller.signal })); assert.equal(calls, 1)
})
