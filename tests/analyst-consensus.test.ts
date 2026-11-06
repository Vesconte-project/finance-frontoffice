import test from 'node:test'
import assert from 'node:assert/strict'
import { readAnalystConsensus, targetDistance, recommendationLabel } from '../lib/analyst-consensus'

const stamp = '2026-11-03T12:00:00+00:00'
const now = Date.parse(stamp)
const sample = () => ({
  version: 'analyst_consensus.v1', symbol: 'QAS', source: 'yahoo_finance', observedAt: stamp,
  providerAsOf: null, currency: 'USD', targets: { low: 80, median: 100, mean: 105, high: 130 },
  analystOpinionCount: 12, recommendation: 'buy', referencePrice: { value: 80, currency: 'USD', asOf: stamp },
  medianUpside: 0.25,
})

test('explicit mean, median, quote and canonical distance remain separate', () => {
  const result = readAnalystConsensus(sample(), 'QAS', now)!
  assert.equal(result.targets.median, 100)
  assert.equal(result.targets.mean, 105)
  assert.equal(result.medianUpside, .25)
  assert.equal(targetDistance(result.medianUpside!), 'The median target is 25% above the latest price.')
  assert.equal(recommendationLabel(result.recommendation), 'Buy')
})

test('an absent median is never filled from mean or an older capture', () => {
  const result = readAnalystConsensus({ ...sample(), targets: { ...sample().targets, median: null } }, 'QAS', now)!
  assert.equal(result.targets.median, null)
  assert.equal(result.medianUpside, null)
  assert.equal(result.targets.mean, 105)
})

test('expired, future, cross-issuer, unknown and malformed snapshots stay unavailable', () => {
  for (const value of [null, {}, [], { ...sample(), symbol: 'OTHER' }, { ...sample(), version: 'unknown' },
    { ...sample(), observedAt: 'invalid' }, { ...sample(), observedAt: '2026-11-03' },
    { ...sample(), observedAt: '2026-09-03T12:00:00Z' }, { ...sample(), observedAt: '2026-11-04T12:00:00Z' }]) {
    assert.equal(readAnalystConsensus(value, 'QAS', now), null)
  }
})

test('currency mismatch, missing quote time and ambiguous minor units cannot produce a distance', () => {
  for (const referencePrice of [{ ...sample().referencePrice, currency: 'EUR' },
    { ...sample().referencePrice, asOf: null }, { ...sample().referencePrice, value: true }]) {
    assert.equal(readAnalystConsensus({ ...sample(), referencePrice }, 'QAS', now)!.medianUpside, null)
  }
  for (const currency of ['GBp', 'GBX', 'ILA', null]) {
    const result = readAnalystConsensus({ ...sample(), currency }, 'QAS', now)!
    assert.equal(result.targets.median, null)
    assert.equal(result.referencePrice, null)
  }
})

test('opinion coverage and recommendation do not invent buy/hold/sell counts', () => {
  const result = readAnalystConsensus(sample(), 'QAS', now)!
  assert.equal(result.analystOpinionCount, 12)
  assert.equal('buyCount' in result, false)
  assert.equal(recommendationLabel('unexpected'), null)
})
