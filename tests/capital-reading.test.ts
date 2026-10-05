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

test('buybacks by year: what was spent, what those shares are worth today and the multiple', async () => {
  const { buybackSummary } = await import('../lib/capital-reading')
  const executions = [
    { id: 'a', date: '2019-03-31', periodStart: null, amount: 100, shares: 10, averagePrice: 10, currency: 'USD' },
    { id: 'b', date: '2019-09-30', periodStart: null, amount: 200, shares: 10, averagePrice: 20, currency: 'USD' },
    { id: 'c', date: '2020-03-31', periodStart: null, amount: 300, shares: null, averagePrice: null, currency: 'USD' },
    { id: 'd', date: '2021-03-31', periodStart: null, amount: 400, shares: 8, averagePrice: 50, currency: 'USD' },
    { id: 'e', date: '2022-03-31', periodStart: null, amount: null, shares: 5, averagePrice: null, currency: 'USD' },
  ]
  const summary = buybackSummary(executions, 40)!
  assert.deepEqual(summary.years.map((year) => year.year), [2019, 2020, 2021])
  assert.deepEqual(summary.years[0], { year: 2019, spent: 300, worthToday: 800, multiple: 800 / 300 })
  assert.equal(summary.years[1].worthToday, null, 'a year without share counts has no value today')
  assert.equal(summary.years[1].multiple, null)
  assert.equal(summary.spent, 1000)
  assert.equal(summary.worthToday, null, 'no total value today when a year is missing it')
  assert.deepEqual(summary.recentYears, [2020, 2021])
  assert.equal(summary.recentShare, 0.7)
  assert.equal(buybackSummary([], 40), null)
  assert.equal(buybackSummary(executions.slice(0, 2), null)!.years[0].worthToday, null, 'no price, no value today')
})
