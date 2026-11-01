import assert from 'node:assert/strict'
import test from 'node:test'
import { selectNextResearchEvent } from '../lib/event-research'

const entry = (domain: string, occursAt: string) => ({ row: { domain, occursAt } })

test('next earnings keeps the summary date when the calendar contains an earlier filing or old schedule', () => {
  const filing = entry('filings', '2026-11-02')
  const oldSchedule = entry('earningsEvents', '2026-11-03')
  const current = entry('earningsEvents', '2026-11-10T09:00:00Z')
  assert.deepEqual(selectNextResearchEvent(false, '2026-11-10', [filing, oldSchedule, current]), {
    entry: current, date: '2026-11-10',
  })
  assert.deepEqual(selectNextResearchEvent(false, '2026-11-10', [filing, oldSchedule]), {
    entry: null, date: '2026-11-10',
  })
})

test('missing next earnings does not revive a calendar entry for a company', () => {
  assert.deepEqual(selectNextResearchEvent(false, null, [entry('earningsEvents', '2026-11-03')]), {
    entry: null, date: null,
  })
})

test('funds continue to use their next generic calendar event', () => {
  const distribution = entry('fundDistributions', '2026-11-02')
  assert.deepEqual(selectNextResearchEvent(true, '2026-11-10', [distribution]), {
    entry: distribution, date: '2026-11-02',
  })
  assert.deepEqual(selectNextResearchEvent(true, null, []), { entry: null, date: null })
})
