import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fetchBackendResponse } from '../lib/backend'

const source = (file: string) => readFileSync(file, 'utf8')

test('calendar and research tab links fetch only on navigation', () => {
  for (const file of [
    'components/calendar/EventCalendar.tsx',
    'components/calendar/WeekBoard.tsx',
    'components/calendar/CalendarLanding.tsx',
    'components/stocks/StockResearchNav.tsx',
  ]) {
    const links = [...source(file).matchAll(/<Link\b[^>]*>/g)]
    assert.ok(links.length > 0, file)
    for (const link of links) assert.match(link[0], /prefetch=\{false\}/, file)
  }
  assert.doesNotMatch(source('components/stocks/TickerTabSwipe.tsx'), /router\.prefetch\(/)
  assert.match(source('components/stocks/TickerTabSwipe.tsx'), /router\.push\(/)
})

test('bounded data caching is limited to public calendar, events and disclosures', () => {
  assert.match(source('lib/calendar-events.ts'), /cache: 'force-cache', next: \{ revalidate: 300 \}/)
  const canonical = source('lib/canonical-research.ts')
  assert.equal((canonical.match(/cache: 'force-cache'/g) ?? []).length, 2)
  for (const context of ['events', 'disclosures']) {
    assert.ok(canonical.includes('context: `ticker.' + context + '.${ticker}`, init: { cache: \'force-cache\', next: { revalidate: 60 } }'))
  }
})

test('backend calls remain uncached by default, including authenticated mutations', async () => {
  const originalFetch = globalThis.fetch
  const originalBase = process.env.BACKEND_BASE_URL
  const originalId = process.env.CF_ACCESS_CLIENT_ID
  const originalSecret = process.env.CF_ACCESS_CLIENT_SECRET
  process.env.BACKEND_BASE_URL = 'https://backend.example.test'
  delete process.env.CF_ACCESS_CLIENT_ID
  delete process.env.CF_ACCESS_CLIENT_SECRET
  const calls: RequestInit[] = []
  globalThis.fetch = async (_url, init) => {
    calls.push(init ?? {})
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    await fetchBackendResponse('/site/research/synthetic/comparisons', {
      context: 'test.private', init: { method: 'POST', body: '{}', headers: { 'x-research-viewer-id': 'user_fixture' } },
    })
    await fetchBackendResponse('/tickers/ACME/events', {
      context: 'test.public', init: { cache: 'force-cache', next: { revalidate: 60 } },
    })
    assert.equal(calls[0]?.cache, 'no-store')
    assert.equal(calls[0]?.method, 'POST')
    assert.equal(new Headers(calls[0]?.headers).get('x-research-viewer-id'), 'user_fixture')
    assert.equal(calls[1]?.cache, 'force-cache')
    assert.equal((calls[1] as RequestInit & { next: { revalidate: number } }).next.revalidate, 60)
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries({ BACKEND_BASE_URL: originalBase, CF_ACCESS_CLIENT_ID: originalId, CF_ACCESS_CLIENT_SECRET: originalSecret })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
