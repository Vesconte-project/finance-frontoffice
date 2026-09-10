import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANALYTICS_MAX_PAYLOAD_KEYS,
  analyticsCategory,
  isAnalyticsEventName,
  normalizePayload,
} from '../lib/analytics-events'
import {
  buildTelemetryLogLine,
  routePattern,
  serializeLogLine,
  TELEMETRY_LOG_PREFIX,
} from '../lib/observability/vercel-log'

const baseInput = {
  eventName: 'button_click',
  occurredAt: '2026-09-10T10:00:00.000Z',
  pathname: '/stocks/AAPL/financials/income',
  sessionId: 'sess_1',
  anonymousId: 'anon_1',
}

test('route pattern collapses dynamic segments so usage aggregates per route', () => {
  assert.equal(routePattern('/stocks/AAPL'), '/stocks/[ticker]')
  assert.equal(routePattern('/stocks/BRK.B/financials/income'), '/stocks/[ticker]/financials/[statement]')
  assert.equal(routePattern('/dashboard/research/9f8c2a1b-77de-4a10-9d31-1a2b3c4d5e6f'), '/dashboard/research/[id]')
  assert.equal(routePattern('/'), '/')
  assert.equal(routePattern('/pricing'), '/pricing')
})

test('route pattern leaves static multi-segment routes untouched', () => {
  assert.equal(routePattern('/markets/network'), '/markets/network')
  assert.equal(routePattern('/picks/long-term'), '/picks/long-term')
})

test('log line is a single flat JSON object with the fields Vercel can filter on', () => {
  const line = buildTelemetryLogLine(baseInput)

  assert.equal(line.logger, TELEMETRY_LOG_PREFIX)
  assert.equal(line.event, 'button_click')
  assert.equal(line.category, 'interaction')
  assert.equal(line.level, 'info')
  assert.equal(line.path, '/stocks/AAPL/financials/income')
  assert.equal(line.route, '/stocks/[ticker]/financials/[statement]')

  const parsed = JSON.parse(serializeLogLine(line)) as Record<string, unknown>
  for (const value of Object.values(parsed)) {
    assert.notEqual(typeof value, 'object', 'log fields must stay flat to remain filterable')
  }
})

test('payload fields are promoted under a prefix and never shadow the envelope', () => {
  const line = buildTelemetryLogLine({
    ...baseInput,
    payload: { control: 'watchlist_toggle', ticker: 'AAPL', path: 'should-not-win' },
  })

  assert.equal(line.p_control, 'watchlist_toggle')
  assert.equal(line.p_ticker, 'AAPL')
  assert.equal(line.path, '/stocks/AAPL/financials/income')
  assert.equal(line.p_path, 'should-not-win')
})

test('serialized line stays inside the runtime-log budget by shedding payload fields', () => {
  const payload: Record<string, string> = {}
  for (let index = 0; index < ANALYTICS_MAX_PAYLOAD_KEYS; index += 1) {
    payload[`field_${index}`] = 'x'.repeat(240)
  }

  const serialized = serializeLogLine(buildTelemetryLogLine({ ...baseInput, payload }))

  assert.ok(Buffer.byteLength(serialized, 'utf8') <= 3500)
  const parsed = JSON.parse(serialized) as Record<string, unknown>
  assert.equal(parsed.truncated, true)
  assert.equal(parsed.event, 'button_click')
  assert.equal(parsed.route, '/stocks/[ticker]/financials/[statement]')
})

test('client errors are logged at a level that separates them from ordinary usage', () => {
  const line = buildTelemetryLogLine({ ...baseInput, eventName: 'client_error', level: 'warn' })
  assert.equal(line.level, 'warn')
  assert.equal(line.category, 'state')
})

test('payload normalization drops unsupported values and clamps strings', () => {
  const normalized = normalizePayload({
    keep: 'value',
    count: 4,
    flag: false,
    nothing: null,
    skipped: undefined,
    nested: { a: 1 },
    list: [1, 2],
    notFinite: Number.POSITIVE_INFINITY,
    long: 'y'.repeat(400),
  })

  assert.deepEqual(Object.keys(normalized).sort(), ['count', 'flag', 'keep', 'long', 'notFinite', 'nothing'])
  assert.equal(normalized.notFinite, null)
  assert.equal((normalized.long as string).length, 256)
})

test('payload normalization caps key count', () => {
  const wide: Record<string, number> = {}
  for (let index = 0; index < ANALYTICS_MAX_PAYLOAD_KEYS + 10; index += 1) wide[`k${index}`] = index

  assert.equal(Object.keys(normalizePayload(wide)).length, ANALYTICS_MAX_PAYLOAD_KEYS)
})

test('only vocabulary names are accepted, so a stray attribute cannot invent a series', () => {
  assert.equal(isAnalyticsEventName('page_view'), true)
  assert.equal(isAnalyticsEventName('watchlist_add'), true)
  assert.equal(isAnalyticsEventName('made_up_event'), false)
  assert.equal(isAnalyticsEventName(null), false)
})

test('categories route each event to a filterable group', () => {
  assert.equal(analyticsCategory('page_view'), 'page')
  assert.equal(analyticsCategory('outbound_click'), 'navigation')
  assert.equal(analyticsCategory('web_vitals'), 'performance')
  assert.equal(analyticsCategory('upgrade_prompt_shown'), 'state')
  assert.equal(analyticsCategory('watchlist_add'), 'feature')
})
