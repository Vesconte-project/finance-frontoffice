import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addTrackValue,
  assertTrackSpec,
  moveTrackValue,
  nearestPreset,
  normaliseTrackValues,
  removeTrackValue,
  snapTrackValue,
  stepTrackValue,
  TRACK_MAX_VALUES,
  trackPosition,
  trackValueAt,
  type TrackSpec,
} from '../lib/model-lab/value-track'

const linear: TrackSpec = { min: 1, max: 120, step: 1, presets: [5, 10, 20] }
const log: TrackSpec = { min: 1, max: 1000, step: 1, scale: 'log', presets: [10, 100] }
const sqrt: TrackSpec = { min: 0, max: 100, step: 1, scale: 'sqrt', presets: [5, 25] }
const fine: TrackSpec = { min: 1, max: 50, step: 0.5, presets: [3, 5] }

test('positions run from 0 at the minimum to 1 at the maximum on every scale', () => {
  for (const spec of [linear, log, sqrt, fine]) {
    assert.equal(trackPosition(spec, spec.min), 0)
    assert.equal(trackPosition(spec, spec.max), 1)
  }
})

test('positions outside the range stay on the rail', () => {
  assert.equal(trackPosition(linear, -50), 0)
  assert.equal(trackPosition(linear, 5000), 1)
})

test('a log track gives small values more room than a linear one', () => {
  assert.ok(trackPosition(log, 10) > trackPosition({ ...log, scale: 'linear' }, 10) * 10)
  assert.ok(trackPosition(log, 10) > 0.3 && trackPosition(log, 10) < 0.4)
})

test('a sqrt track gives small values more room than a linear one', () => {
  assert.ok(trackPosition(sqrt, 25) > trackPosition({ ...sqrt, scale: 'linear' }, 25))
  assert.equal(trackPosition(sqrt, 25), 0.5)
})

test('trackValueAt inverts trackPosition', () => {
  for (const spec of [linear, sqrt, fine]) {
    for (const value of [spec.min, spec.presets[0], spec.presets[1], spec.max]) {
      assert.equal(trackValueAt(spec, trackPosition(spec, value)), value)
    }
  }
  assert.equal(trackValueAt(log, trackPosition(log, 100)), 100)
})

test('trackValueAt clamps positions outside 0..1', () => {
  assert.equal(trackValueAt(linear, -1), 1)
  assert.equal(trackValueAt(linear, 2), 120)
})

test('snapping lands on the step grid and inside the range', () => {
  assert.equal(snapTrackValue(fine, 3.26), 3.5)
  assert.equal(snapTrackValue(fine, 3.24), 3)
  assert.equal(snapTrackValue(linear, 0), 1)
  assert.equal(snapTrackValue(linear, 999), 120)
})

test('snapping does not leave floating point residue', () => {
  assert.equal(snapTrackValue(fine, 2.30000000001), 2.5)
  assert.equal(String(snapTrackValue(fine, 7.5)), '7.5')
})

test('a log track snaps large values to two significant digits', () => {
  assert.equal(snapTrackValue(log, 137), 140)
  assert.equal(snapTrackValue(log, 8), 8)
})

test('values are normalised: snapped, unique, ascending, finite', () => {
  assert.deepEqual(normaliseTrackValues(linear, [20, 5, 5, 10.2, Number.NaN]), [5, 10, 20])
})

test('a track never holds more than the maximum number of values', () => {
  const many = Array.from({ length: 20 }, (_, i) => i + 1)
  assert.equal(normaliseTrackValues(linear, many).length, TRACK_MAX_VALUES)
})

test('adding keeps order and ignores repeats', () => {
  assert.deepEqual(addTrackValue(linear, [5, 20], 10), [5, 10, 20])
  assert.deepEqual(addTrackValue(linear, [5, 20], 20), [5, 20])
})

test('removing never empties a track', () => {
  assert.deepEqual(removeTrackValue(linear, [5, 10, 20], 10), [5, 20])
  assert.deepEqual(removeTrackValue(linear, [5], 5), [5])
})

test('moving a point replaces it, and landing on another point merges the two', () => {
  assert.deepEqual(moveTrackValue(linear, [5, 10, 20], 10, 12), [5, 12, 20])
  assert.deepEqual(moveTrackValue(linear, [5, 10, 20], 10, 20), [5, 20])
  assert.deepEqual(moveTrackValue(linear, [5, 10, 20], 10, 400), [5, 20, 120])
})

test('keyboard steps are one step, or ten when coarse, and stop at the ends', () => {
  assert.equal(stepTrackValue(linear, 10, 1), 11)
  assert.equal(stepTrackValue(linear, 10, -1), 9)
  assert.equal(stepTrackValue(linear, 10, 1, true), 20)
  assert.equal(stepTrackValue(linear, 1, -1), 1)
  assert.equal(stepTrackValue(linear, 120, 1), 120)
  assert.equal(stepTrackValue(fine, 3, 1), 3.5)
})

test('a click near a tick means the tick', () => {
  const t = trackPosition(linear, 10)
  assert.equal(nearestPreset(linear, t + 0.005, 0.02), 10)
  assert.equal(nearestPreset(linear, t + 0.2, 0.02), null)
})

test('an invalid track is refused', () => {
  assert.throws(() => assertTrackSpec({ min: 5, max: 5, step: 1, presets: [] }))
  assert.throws(() => assertTrackSpec({ min: 1, max: 5, step: 0, presets: [] }))
  assert.throws(() => assertTrackSpec({ min: 0, max: 5, step: 1, scale: 'log', presets: [] }))
  assert.doesNotThrow(() => assertTrackSpec(linear))
})
