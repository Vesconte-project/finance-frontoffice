import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEventMarkers, markerBarIndex, stackMarkerLevels, type EventRowLike } from '../lib/event-markers'
import { distanceFromAverage } from '../lib/technical-readings'

const row = (overrides: Partial<EventRowLike>): EventRowLike => ({
  domain: 'earningsEvents',
  eventId: null,
  eventType: 'earnings',
  title: 'Q1 results',
  occursAt: '2026-01-20',
  knownAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

test('one marker per event: the latest revision wins and its date moves with it', () => {
  const markers = buildEventMarkers([
    row({ eventId: 'e1', occursAt: '2026-01-27', knownAt: '2025-12-01T00:00:00Z' }),
    row({ eventId: 'e1', occursAt: '2026-01-20', knownAt: '2026-01-05T00:00:00Z' }),
    row({ eventId: 'e1', occursAt: '2026-01-20', knownAt: '2026-01-02T00:00:00Z' }),
  ], '2026-10-04')
  assert.deepEqual(markers, [{ id: 'e1', date: '2026-01-20', category: 'earnings', title: 'Q1 results' }])
})

test('recurring events with the same title stay separate when they have their own ids', () => {
  const markers = buildEventMarkers([
    row({ domain: 'corporateActions', eventType: 'cash_dividend', title: 'Quarterly dividend', eventId: 'd1', occursAt: '2026-02-10' }),
    row({ domain: 'corporateActions', eventType: 'cash_dividend', title: 'Quarterly dividend', eventId: 'd2', occursAt: '2026-05-10' }),
  ], '2026-10-04')
  assert.deepEqual(markers.map((marker) => [marker.date, marker.category]), [['2026-02-10', 'dividends'], ['2026-05-10', 'dividends']])
})

test('future, undated, untitled and market-wide events are left off the chart', () => {
  const markers = buildEventMarkers([
    row({ eventId: 'future', occursAt: '2026-11-01' }),
    row({ eventId: 'undated', occursAt: null }),
    row({ eventId: 'untitled', title: '  ' }),
    row({ eventId: 'macro', domain: 'economicReleases', title: 'CPI' }),
    row({ eventId: 'meeting', domain: 'investorEvents', eventType: 'meeting', title: 'Annual meeting', occursAt: '2026-03-01' }),
  ], '2026-10-04')
  assert.deepEqual(markers.map((marker) => [marker.id, marker.category]), [['meeting', 'company']])
})

test('an event lands on its own trading day, or the next session after a closed day', () => {
  const dates = ['2026-01-16', '2026-01-20', '2026-01-21']
  assert.equal(markerBarIndex(dates, '2026-01-20'), 1)
  assert.equal(markerBarIndex(dates, '2026-01-18'), 1, 'a Sunday belongs to the next session')
  assert.equal(markerBarIndex(dates, '2026-01-10'), null)
  assert.equal(markerBarIndex(dates, '2026-01-22'), null)
  assert.equal(markerBarIndex([], '2026-01-20'), null)
})

test('markers closer than the gap stack upwards; distant ones stay on the first level', () => {
  assert.deepEqual(stackMarkerLevels([100, 104, 108, 300, 200], 15), [0, 1, 2, 0, 0])
  assert.deepEqual(stackMarkerLevels([100, 130], 15), [0, 0])
  assert.deepEqual(stackMarkerLevels([], 15), [])
})

test('distance to an average is a signed percentage of the average', () => {
  assert.equal(distanceFromAverage(110, 100), 10)
  assert.equal(distanceFromAverage(95, 100), -5)
  assert.equal(distanceFromAverage(null, 100), null)
  assert.equal(distanceFromAverage(100, 0), null)
})
