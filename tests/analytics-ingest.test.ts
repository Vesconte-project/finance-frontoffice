import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_EVENTS_PER_REQUEST, readEvents, toInsertRow } from '../lib/analytics-ingest'

test('a single envelope is still accepted, so an already-loaded page keeps reporting', () => {
  const events = readEvents({ event_name: 'page_view', pathname: '/pricing' })

  assert.equal(events.length, 1)
  assert.equal(events[0].event_name, 'page_view')
})

test('a batch is unwrapped in order', () => {
  const events = readEvents({
    events: [
      { event_name: 'page_view' },
      { event_name: 'button_click' },
      { event_name: 'watchlist_add' },
    ],
  })

  assert.deepEqual(
    events.map((event) => event.event_name),
    ['page_view', 'button_click', 'watchlist_add']
  )
})

test('a batch is capped rather than rejected, so a runaway client loses events not the request', () => {
  const oversized = Array.from({ length: MAX_EVENTS_PER_REQUEST + 25 }, () => ({ event_name: 'button_click' }))

  assert.equal(readEvents({ events: oversized }).length, MAX_EVENTS_PER_REQUEST)
})

test('malformed bodies yield no events instead of throwing', () => {
  assert.deepEqual(readEvents(null), [])
  assert.deepEqual(readEvents('not-an-object'), [])
  assert.deepEqual(readEvents({}), [])
  assert.deepEqual(readEvents({ events: 'nope' }), [])
  assert.deepEqual(readEvents({ event_name: 42 }), [])
})

test('non-object batch entries are discarded', () => {
  const events = readEvents({ events: [{ event_name: 'page_view' }, null, 'x', 7, ['a']] })

  assert.equal(events.length, 1)
  assert.equal(events[0].event_name, 'page_view')
})

test('insert row fills defaults for every missing field', () => {
  const row = toInsertRow({}, null)

  assert.equal(row.event_name, 'unknown_event')
  assert.equal(row.pathname, '/')
  assert.equal(row.session_id, 'unknown_session')
  assert.equal(row.anonymous_id, 'unknown_anon')
  assert.equal(row.referrer, null)
  assert.equal(row.user_agent, null)
  assert.deepEqual(row.payload, {})
  assert.ok(Number.isFinite(new Date(row.occurred_at).getTime()))
})

test('insert row keeps a valid timestamp and falls back when one is unusable', () => {
  assert.equal(
    toInsertRow({ occurred_at: '2026-09-10T10:00:00.000Z' }, null).occurred_at,
    '2026-09-10T10:00:00.000Z'
  )
  assert.ok(Number.isFinite(new Date(toInsertRow({ occurred_at: 'yesterday' }, null).occurred_at).getTime()))
  // The legacy field name is honoured when occurred_at is absent.
  assert.equal(toInsertRow({ timestamp: '2026-01-02T03:04:05.000Z' }, null).occurred_at, '2026-01-02T03:04:05.000Z')
})

test('array and scalar payloads are normalized to an object', () => {
  assert.deepEqual(toInsertRow({ payload: ['a'] as unknown as Record<string, unknown> }, null).payload, {})
  assert.deepEqual(toInsertRow({ payload: 'x' as unknown as Record<string, unknown> }, null).payload, {})
  assert.deepEqual(toInsertRow({ payload: { control: 'x' } }, null).payload, { control: 'x' })
})

test('user agent comes from the request, never from the client body', () => {
  assert.equal(toInsertRow({ event_name: 'page_view' }, 'Mozilla/5.0').user_agent, 'Mozilla/5.0')
})
