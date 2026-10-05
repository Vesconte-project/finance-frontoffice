import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMultiple, highestPoint, lineGeometry, multipleSeries, timePositions, timeTicks } from '../lib/valuation-reading'

test('a multiple is one reported value per day, oldest first, latest revision winning', () => {
  const series = multipleSeries([
    { value: 30, observationDate: '2026-09-02', knownAt: '2026-09-02T20:00:00Z' },
    { value: 31, observationDate: '2026-09-02', knownAt: '2026-09-03T08:00:00Z' },
    { value: 29, observationDate: '2026-09-01', knownAt: '2026-09-01T20:00:00Z' },
    { value: null, observationDate: '2026-09-03', knownAt: '2026-09-03T20:00:00Z' },
    { value: 28, observationDate: 'bad', knownAt: null },
  ])
  assert.deepEqual(series, [{ date: '2026-09-01', value: 29 }, { date: '2026-09-02', value: 31 }])
})

test('the highest point is a reported observation; ties keep the latest', () => {
  const points = [{ date: '2026-01-01', value: 20 }, { date: '2026-02-01', value: 25 }, { date: '2026-03-01', value: 25 }, { date: '2026-04-01', value: 22 }]
  assert.deepEqual(highestPoint(points), { index: 2, point: points[2] })
  assert.equal(highestPoint([]), null)
})

test('time places observations by date, and names years or months without crowding', () => {
  assert.deepEqual(timePositions(['2026-01-01', '2026-01-11', '2026-01-31']), [0, 1 / 3, 1])
  const months = timeTicks(['2026-06-29', '2026-09-04'], 8)
  assert.deepEqual(months.map((tick) => tick.label), ['Jul', 'Aug', 'Sep'])
  const years = timeTicks(['2016-03-01', '2026-03-01'], 5)
  assert.ok(years.length <= 5)
  assert.equal(years.at(-1)!.label, '2026')
  assert.ok(years.every((tick) => tick.position >= 0 && tick.position <= 1))
  assert.equal(timeTicks(['2026-01-01'], 4).length, 0)
  const january = timeTicks(['2025-11-15', '2026-02-10'], 8)
  assert.ok(january.some((tick) => tick.label === 'Jan 2026'), 'a new year is named on its January')
})

test('the line stays inside its box and multiples are written plainly', () => {
  const box = { width: 640, height: 260 }
  const geometry = lineGeometry([{ date: '2026-01-01', value: 20 }, { date: '2026-02-01', value: 30 }, { date: '2026-03-01', value: 25 }], box)
  assert.ok(geometry.xs.every((x) => x >= 0 && x <= box.width))
  assert.ok(geometry.ys.every((y) => y >= 34 - 1e-9 && y <= box.height - 30 + 1e-9))
  assert.ok(geometry.ys[1] < geometry.ys[2] && geometry.ys[2] < geometry.ys[0], 'higher values sit higher')
  const flat = lineGeometry([{ date: '2026-01-01', value: 20 }, { date: '2026-02-01', value: 20 }], box)
  assert.ok(flat.ys.every((y) => Number.isFinite(y)))
  assert.equal(formatMultiple(27.04), '27×')
  assert.equal(formatMultiple(6.48), '6.48×')
  assert.equal(formatMultiple(-12.3), '−12.3×')
})
