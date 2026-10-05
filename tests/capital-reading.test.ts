import assert from 'node:assert/strict'
import test from 'node:test'
import { buybackExecutions, type CapitalEventLike } from '../lib/capital-reading'

function event(overrides: Partial<CapitalEventLike>): CapitalEventLike {
  return {
    eventId: null, eventFamily: null, eventType: null, eventSubtype: null, programName: null,
    announcementDate: null, filingDate: null, effectiveDate: null, periodStart: null, periodEnd: null,
    amountExecuted: null, shareCountExecuted: null, averagePrice: null, currency: 'USD',
    ...overrides,
  }
}

test('buybacks are reported repurchase executions since a date, oldest first', () => {
  const rows = [
    event({ eventId: 'b2', eventType: 'share_repurchase', periodEnd: '2025-12-31', amountExecuted: 2e9, shareCountExecuted: 1e7, averagePrice: 200 }),
    event({ eventId: 'b1', eventFamily: 'buyback', periodStart: '2025-01-01', periodEnd: '2025-03-31', amountExecuted: 1e9 }),
    event({ eventId: 'b1', eventFamily: 'buyback', periodEnd: '2025-03-31', amountExecuted: 9e9 }), // same event again: first wins
    event({ eventId: 'old', eventType: 'share_repurchase', periodEnd: '2015-06-30', amountExecuted: 5e8 }),
    event({ eventId: 'auth', eventType: 'share_repurchase_authorization', announcementDate: '2024-05-01' }), // nothing executed
    event({ eventId: 'shelf', eventType: 'shelf_registration', filingDate: '2025-02-01', amountExecuted: 3e9 }), // not a buyback
    event({ eventId: 'undated', eventType: 'share_repurchase', amountExecuted: 1e9 }),
  ]
  const executions = buybackExecutions(rows, '2016-01-01')
  assert.deepEqual(executions.map((execution) => execution.id), ['b1', 'b2'])
  assert.deepEqual(executions[0], { id: 'b1', date: '2025-03-31', periodStart: '2025-01-01', amount: 1e9, shares: null, averagePrice: null, currency: 'USD' })
  assert.equal(executions[1].averagePrice, 200)
  // Only what was reported: no totals, no value today.
  assert.deepEqual(Object.keys(executions[1]).sort(), ['amount', 'averagePrice', 'currency', 'date', 'id', 'periodStart', 'shares'])
})

test('an execution with only a share count is kept, and the program name can mark it', () => {
  const executions = buybackExecutions([
    event({ eventId: 'p', eventType: 'capital_return', programName: '2024 Share Buy-back Programme', effectiveDate: '2024-06-30', shareCountExecuted: 4e6 }),
  ], '2016-01-01')
  assert.equal(executions.length, 1)
  assert.equal(executions[0].amount, null)
  assert.equal(executions[0].shares, 4e6)
})
