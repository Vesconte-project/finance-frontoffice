import assert from 'node:assert/strict'
import test from 'node:test'
import { labelPosition, PLOT_MIN_WIDTH, plotPercent, plotUnits, stackLabels } from '../lib/chart-labels'

test('plot coordinates become clamped percentages of the frame', () => {
  assert.equal(plotPercent(50, 200), '25%')
  assert.equal(plotPercent(1, 3), '33.333%')
  assert.equal(plotPercent(-10, 200), '0%')
  assert.equal(plotPercent(260, 200), '100%')
  assert.equal(plotPercent(Number.NaN, 200), '0%')
  assert.equal(plotPercent(10, 0), '0%')
})

test('a label is pinned by its anchor, not by its top-left corner', () => {
  const box = { width: 400, height: 200 }
  assert.deepEqual(labelPosition(box, 100, 50), { left: '25%', top: '25%', transform: 'translate(-50%, -50%)' })
  assert.deepEqual(labelPosition(box, 400, 0, 'end', 'start'), { left: '100%', top: '0%', transform: 'translate(-100%, 0%)' })
  assert.equal(labelPosition(box, 0, 200, 'start', 'end').transform, 'translate(0%, -100%)')
})

test('labels that fit stay where they were wanted', () => {
  const placed = stackLabels(
    [
      { key: 'a', at: 20, size: 10 },
      { key: 'b', at: 60, size: 10 },
    ],
    { min: 0, max: 100, gap: 2 },
  )
  assert.deepEqual(placed.map((item) => item.placed), [20, 60])
})

test('crowded labels are pushed apart in order and kept on the plot', () => {
  const items = [
    { key: 'net', at: 92, size: 12 },
    { key: 'tax', at: 90, size: 12 },
    { key: 'ops', at: 40, size: 12 },
    { key: 'cost', at: 41, size: 12 },
  ]
  const placed = stackLabels(items, { min: 0, max: 100, gap: 2 })
  // Identity and input order are preserved.
  assert.deepEqual(placed.map((item) => item.key), ['net', 'tax', 'ops', 'cost'])
  const byCentre = [...placed].sort((a, b) => a.placed - b.placed)
  for (let i = 1; i < byCentre.length; i += 1) {
    const previous = byCentre[i - 1]
    const current = byCentre[i]
    assert.ok(
      current.placed - current.size / 2 >= previous.placed + previous.size / 2 + 2 - 1e-9,
      `${previous.key} and ${current.key} overlap`,
    )
  }
  for (const item of placed) {
    assert.ok(item.placed - item.size / 2 >= 0 && item.placed + item.size / 2 <= 100, `${item.key} leaves the plot`)
  }
  // Ties keep their input order along the axis; the lower wanted centre stays above.
  assert.ok(placed[1].placed < placed[0].placed, 'tax (90) stays above net (92)')
  assert.ok(placed[2].placed < placed[3].placed, 'ops (40) stays above cost (41)')
})

test('labels that cannot all fit share the space evenly instead of leaving the plot', () => {
  const items = Array.from({ length: 6 }, (_, index) => ({ key: String(index), at: 50, size: 30 }))
  const placed = stackLabels(items, { min: 0, max: 100, gap: 4 })
  const centres = placed.map((item) => item.placed)
  assert.equal(centres[0], 15)
  assert.equal(centres.at(-1), 85)
  const steps = centres.slice(1).map((centre, index) => centre - centres[index])
  for (const step of steps) assert.ok(Math.abs(step - steps[0]) < 1e-9)
})

test('an empty column of labels is left alone', () => {
  assert.deepEqual(stackLabels([], { min: 0, max: 10 }), [])
})

test('label sizes are converted to plot units at the narrowest width the plot is shown', () => {
  const box = { width: 600, height: 240 }
  // A 16px label on a plot drawn 300px wide spans twice as many plot units.
  assert.equal(plotUnits(16, box, 300), 32)
  assert.equal(plotUnits(16, box, 600), 16)
  assert.equal(plotUnits(16, box, 0), 16)
  assert.ok(PLOT_MIN_WIDTH.compact < PLOT_MIN_WIDTH.wide)
  assert.equal(PLOT_MIN_WIDTH.wide, 520, 'matches the 32.5rem switch in ChartFrame.module.css')
})
