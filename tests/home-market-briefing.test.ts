import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHomeScoreChanges } from '../lib/home-market-briefing'

const change = { ticker: 'QADEMO.T', reading: 'income', previous: 71, next: 32 }

test('homepage briefing reads canonical score changes in API order', () => {
  const second = { ticker: 'QAT', reading: 'shortTerm', previous: 51, next: 82 }
  assert.deepEqual(parseHomeScoreChanges({ scoreChanges: { status: 'available', items: [change, second] } }), [
    { symbol: 'QADEMO.T', reading: 'income', previous: 71, next: 32 },
    { symbol: 'QAT', reading: 'shortTerm', previous: 51, next: 82 },
  ])
})

test('homepage briefing distinguishes an empty publication from unavailable data', () => {
  assert.deepEqual(parseHomeScoreChanges({ scoreChanges: { status: 'available', items: [] } }), [])
  assert.equal(parseHomeScoreChanges({
    scoreChanges: { status: 'unavailable', reason: 'insufficient_comparable_observations', items: [] },
  }), null)
  assert.equal(parseHomeScoreChanges(null), null)
})

test('homepage briefing rejects malformed scores and legacy and oversized lists', () => {
  for (const invalid of [
    { ...change, next: 101 },
    { ...change, previous: '71' },
    { ...change, reading: 'other' },
    { ...change, ticker: '' },
  ]) {
    assert.equal(parseHomeScoreChanges({ scoreChanges: { status: 'available', items: [invalid] } }), null)
  }
  assert.equal(parseHomeScoreChanges({ scoreChanges: [change] }), null)
  assert.equal(parseHomeScoreChanges({
    scoreChanges: { status: 'available', items: [change, change, change, change] },
  }), null)
})
