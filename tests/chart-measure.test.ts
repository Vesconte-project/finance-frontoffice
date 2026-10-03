import assert from 'node:assert/strict'
import test from 'node:test'
import { candleDirection } from '../lib/candles'
import { formatSignedPercent, formatSpan, measureBetween, placeReading, type MeasurePoint } from '../lib/chart-measure'

// Synthetic closes on consecutive weekdays (Thu, Fri, Mon, Tue).
const points: MeasurePoint[] = [
  { date: '2026-09-24', value: 100 },
  { date: '2026-09-25', value: 104 },
  { date: '2026-09-28', value: 98 },
  { date: '2026-09-29', value: 110 },
]

test('measures from the earlier to the later day, in either picking order', () => {
  const forward = measureBetween(points, 0, 3)!
  const backward = measureBetween(points, 3, 0)!
  assert.deepEqual(forward, backward)
  assert.equal(forward.from.date, '2026-09-24')
  assert.equal(forward.to.date, '2026-09-29')
  assert.equal(forward.change, 10)
  assert.equal(forward.percent, 10)
  assert.equal(forward.direction, 'up')
})

test('counts calendar days and trading sessions separately', () => {
  const span = measureBetween(points, 1, 2)!
  // Friday to Monday: three calendar days, one session.
  assert.equal(span.calendarDays, 3)
  assert.equal(span.sessions, 1)
  assert.equal(span.direction, 'down')
  assert.equal(formatSpan(span), '3 days · 1 session')
})

test('one day, or an index outside the series, is not a measurement', () => {
  assert.equal(measureBetween(points, 2, 2), null)
  assert.equal(measureBetween(points, 2.2, 1.8), null)
  assert.equal(measureBetween(points, 0, 9), null)
  assert.equal(measureBetween(points, -1, 2), null)
})

test('a zero starting close has no percentage, rather than an invented one', () => {
  const span = measureBetween([{ date: '2026-09-24', value: 0 }, { date: '2026-09-25', value: 2 }], 0, 1)!
  assert.equal(span.percent, null)
  assert.equal(span.change, 2)
})

test('percentages carry their sign', () => {
  assert.equal(formatSignedPercent(5.4), '+5.40%')
  assert.equal(formatSignedPercent(-2), '−2.00%')
  assert.equal(formatSignedPercent(0), '0.00%')
})

test('a candle without an open is neutral, never assumed to be rising', () => {
  assert.equal(candleDirection(10, 11), 'up')
  assert.equal(candleDirection(10, 10), 'up')
  assert.equal(candleDirection(10, 9), 'down')
  assert.equal(candleDirection(null, 9), 'unknown')
  assert.equal(candleDirection(undefined, 9), 'unknown')
})

// A 360x240 chart with a 200x110 reading and buttons over the top-left corner.
const bounds = { width: 360, height: 240 }
const reading = { width: 200, height: 110 }
const corner = { left: 0, top: 0, width: 102, height: 54 }
const within = ({ left, top }: { left: number; top: number }) =>
  left >= 0 && top >= 0 && left + reading.width <= bounds.width && top + reading.height <= bounds.height
const coversPoint = ({ left, top }: { left: number; top: number }, point: { x: number; y: number }) =>
  point.x >= left && point.x <= left + reading.width && point.y >= top && point.y <= top + reading.height

test('the reading sits right of a day on the left, clear of the corner buttons', () => {
  const point = { x: 20, y: 120 }
  const at = placeReading(point, reading, bounds, corner)
  assert.ok(within(at))
  assert.ok(at.left > point.x)
  assert.ok(at.left >= corner.width || at.top >= corner.height)
})

test('the reading flips left of a day near the right edge instead of leaving the chart', () => {
  const point = { x: 330, y: 120 }
  const at = placeReading(point, reading, bounds, corner)
  assert.ok(within(at))
  assert.ok(at.left + reading.width < point.x)
})

test('with no room beside the day, the reading goes above or below it, never over it', () => {
  for (const point of [{ x: 180, y: 200 }, { x: 180, y: 30 }]) {
    const at = placeReading(point, reading, bounds, corner)
    assert.ok(within(at), JSON.stringify(at))
    assert.ok(!coversPoint(at, point), JSON.stringify(at))
  }
})

test('a reading too big for every side falls back to the farthest free corner', () => {
  const at = placeReading({ x: 60, y: 200 }, { width: 300, height: 200 }, bounds, null)
  assert.deepEqual(at, { left: 54, top: 6 })
})
