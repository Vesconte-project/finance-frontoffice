import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeEarningsHistory, selectNextResearchEvent } from '../lib/event-research'
import { descriptionSourceLabel } from '../lib/research-provenance'

const entry = (domain: string, occursAt: string) => ({ row: { domain, occursAt } })

test('next earnings keeps the summary date when the calendar contains an earlier filing or old schedule', () => {
  const filing = entry('filings', '2026-11-02')
  const oldSchedule = entry('earningsEvents', '2026-11-03')
  const current = entry('earningsEvents', '2026-11-10T09:00:00Z')
  assert.deepEqual(selectNextResearchEvent(false, '2026-11-10', [filing, oldSchedule, current], '2026-11-01'), {
    entry: current, date: '2026-11-10',
  })
  assert.deepEqual(selectNextResearchEvent(false, '2026-11-10', [filing, oldSchedule], '2026-11-01'), {
    entry: null, date: '2026-11-10',
  })
})

test('missing next earnings does not revive a calendar entry for a company', () => {
  assert.deepEqual(selectNextResearchEvent(false, null, [entry('earningsEvents', '2026-11-03')], '2026-11-01'), {
    entry: null, date: null,
  })
})

test('funds continue to use their next generic calendar event', () => {
  const distribution = entry('fundDistributions', '2026-11-02')
  assert.deepEqual(selectNextResearchEvent(true, '2026-11-10', [distribution], '2026-11-01'), {
    entry: distribution, date: '2026-11-02',
  })
  assert.deepEqual(selectNextResearchEvent(true, null, [], '2026-11-01'), { entry: null, date: null })
})


test('a stale summary cannot advertise yesterday as the next earnings date', () => {
  const stale = entry('earningsEvents', '2026-10-31')
  assert.deepEqual(selectNextResearchEvent(false, '2026-10-31', [stale], '2026-11-01'), {
    entry: null, date: null,
  })
  assert.equal(selectNextResearchEvent(false, '2026-11-01', [], '2026-11-01').date, '2026-11-01')
  assert.equal(selectNextResearchEvent(false, 'invalid', [], '2026-11-01').date, null)
})

test('description sources use an allowlist instead of exposing technical identifiers', () => {
  assert.equal(descriptionSourceLabel('yahoo_finance'), 'Yahoo Finance')
  assert.equal(descriptionSourceLabel('feature_store.entity_attributes_static'), 'Vesconte company profile')
  for (const value of ['data_ops', 'unknown_provider', '__proto__', '', null, undefined]) {
    assert.equal(descriptionSourceLabel(value), null)
  }
})


test('distinct reported dates with a colliding fiscal label survive frontend normalization', () => {
  const row = (earningsDate: string) => ({ ticker: 'AIR', earningsDate, fiscalPeriod: '2014Q3',
    epsActual: 1, epsEstimate: null, epsSurprisePct: null,
    revenueActual: null, revenueEstimate: null, revenueSurprisePct: null })
  const normalized = normalizeEarningsHistory([row('2014-07-15'), row('2014-09-23')])
  assert.equal(normalized.rows.length, 2)
  assert.deepEqual(normalized.duplicateKeys, [])
})
