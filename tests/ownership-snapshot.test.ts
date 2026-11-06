import assert from 'node:assert/strict'
import test from 'node:test'
import { parseOwnershipSnapshot } from '../lib/ownership-snapshot'

const now = Date.parse('2026-11-04T12:00:00Z')
const doc = { symbol: 'QAS', source: 'yahoo_finance', unit: 'fraction', providerAsOf: null,
  observedAt: '2026-11-04T11:00:00Z', institutionsFraction: .9, insidersFraction: .2 }

test('ownership keeps independent reported fractions, valid zero and missing values', () => {
  assert.deepEqual(parseOwnershipSnapshot(doc, 'QAS', now), {
    observedAt: doc.observedAt, institutionsFraction: .9, insidersFraction: .2,
  })
  const partial = parseOwnershipSnapshot({ ...doc, institutionsFraction: null, insidersFraction: 0 }, 'QAS', now)
  assert.equal(partial?.institutionsFraction, null)
  assert.equal(partial?.insidersFraction, 0)
})

test('ownership rejects stale/future/naive/untrusted snapshots without older-field fallback', () => {
  for (const bad of [null, [], { ...doc, symbol: 'OTHER' }, { ...doc, source: 'other' },
    { ...doc, unit: 'percent' }, { ...doc, providerAsOf: '2026-11-04' },
    { ...doc, observedAt: '2026-11-04T11:00:00' }, { ...doc, observedAt: 'bad' },
    { ...doc, observedAt: '2026-11-05T11:00:00Z' }, { ...doc, observedAt: '2026-10-20T11:00:00Z' }]) {
    assert.equal(parseOwnershipSnapshot(bad, 'QAS', now), null)
  }
  assert.ok(parseOwnershipSnapshot({ ...doc, observedAt: '2026-10-21T11:00:00Z' }, 'QAS', now))
})

test('ownership never coerces percent strings, clamps excess or adds a remainder', () => {
  for (const value of [true, '0.5', -1, 1.01, Infinity, NaN, {}]) {
    const out = parseOwnershipSnapshot({ ...doc, institutionsFraction: value }, 'QAS', now)
    assert.equal(out?.institutionsFraction, null)
    assert.equal(out?.insidersFraction, .2)
    assert.equal(Object.keys(out!).length, 3)
  }
})
