import assert from 'node:assert/strict'
import test from 'node:test'
import { cashForOwners } from '../lib/cash-for-owners'
import type { StatementRowLike } from '../lib/statement-reading'

type Row = StatementRowLike & { statementType?: string }
const sec = (lineItemId: string, value: number | null, year = 2025, extra: Partial<Row> = {}): Row => ({
  lineItemId, value, displayLabel: null, currency: 'USD', periodType: 'annual', fiscalYear: year,
  periodEnd: `${year}-09-30`, statementType: 'cash_flow', source: 'sec_selection', accession: `acc-${year}`, ...extra,
})
const composition = [
  { lineItemId: 'operating_cash_flow', concept: 'us-gaap:NetCashProvidedByUsedInOperatingActivities' },
  { lineItemId: 'capital_expenditure', concept: 'us-gaap:PaymentsToAcquirePropertyPlantAndEquipment' },
  { lineItemId: 'capitalized_software_payments', concept: 'us-gaap:PaymentsToDevelopSoftware' },
]
const fcf = (value: number | null, year = 2025, extra: Partial<Row> = {}) =>
  sec('free_cash_flow', value, year, { definitionId: 'sec_selection.free_cash_flow.v1', composition, ...extra })

test('free cash flow shows its parts only from the same filing, as published', () => {
  const rows = [fcf(70), sec('operating_cash_flow', 100), sec('capital_expenditure', -25), sec('capitalized_software_payments', -5),
    sec('reinvestment_total', -30), sec('stock_based_compensation', 12, 2025, { accession: 'other' }), fcf(60, 2024)]
  const cash = cashForOwners(rows)
  assert.deepEqual(cash.points.map((point) => [point.year, point.value]), [[2024, 60], [2025, 70]])
  assert.equal(cash.latest?.ourDefinition, true)
  assert.equal(cash.latest?.partsFromFiling, true)
  assert.deepEqual(cash.latest?.parts.map((part) => part.value), [100, -25, -5])
  assert.equal(cash.latest?.reinvestment, -30)
  // Pay in shares is named beside it, never taken off: the figure stays as published.
  assert.equal(cash.latest?.shareBasedPay, 12)
  assert.equal(cash.latest?.value, 70)
})

test('a part from another filing hides every amount, and an empty year keeps its reason', () => {
  const rows = [fcf(null, 2025, { emptyReason: 'exceeds_productive_asset_purchases' }), fcf(70, 2025), // older revision
    fcf(60, 2024), sec('operating_cash_flow', 90, 2024), sec('capital_expenditure', -30, 2024, { accession: 'later-10-K' }),
    sec('capitalized_software_payments', -5, 2024)]
  const cash = cashForOwners(rows)
  assert.equal(cash.latest?.year, 2024)
  assert.equal(cash.latest?.partsFromFiling, false)
  assert.deepEqual(cash.latest?.parts.map((part) => part.value), [90, null, -5])
  assert.deepEqual(cash.origin.empty, [{ periodEnd: '2025-09-30', year: 2025, reason: 'exceeds_productive_asset_purchases' }])
  assert.deepEqual(cash.points.map((point) => point.year), [2024])
})

test('a provider series is labelled as published, with no parts claimed', () => {
  const rows = [sec('free_cash_flow', 50, 2025, { source: 'yahoo_finance', definitionId: 'yahoo_finance.free_cash_flow.provider', accession: null })]
  const cash = cashForOwners(rows)
  assert.equal(cash.latest?.ourDefinition, false)
  assert.deepEqual(cash.latest?.parts, [])
  assert.equal(cash.latest?.partsFromFiling, false)
  assert.equal(cashForOwners([]).latest, null)
})
