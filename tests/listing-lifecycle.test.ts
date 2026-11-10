import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lifecycleView, historyThrough } from '../lib/listing-lifecycle'
const suspended = { lifecycle_state: 'suspended', suspension_reason: 'invalid_source_data', suspended_at: '2026-09-23T12:00:00Z', review_by: '2026-11-12T12:00:00Z', lifecycle_revision: 'synthetic' }
test('suspension has a public explanation and a dated historical boundary', () => {
  assert.deepEqual(lifecycleView(suspended), { state: 'suspended', reason: 'Foram detetadas inconsistências nos dados do fornecedor.', date: '2026-09-23', reviewBy: '2026-11-12' })
  assert.deepEqual(historyThrough([{ date: '2026-09-22' }, { date: '2026-09-23' }, { date: '2026-09-24' }], suspended.suspended_at), [{ date: '2026-09-22' }, { date: '2026-09-23' }])
})
test('unknown states, missing state and invalid suspended metadata fail closed', () => {
  for (const value of [undefined, {}, { lifecycle_state: 'unknown' }, { ...suspended, suspension_reason: 'private free text' }, { ...suspended, suspended_at: 'bad' }]) assert.equal(lifecycleView(value).state, 'unavailable')
  assert.equal(lifecycleView({ lifecycle_state: 'active' }).state, 'available')
})
