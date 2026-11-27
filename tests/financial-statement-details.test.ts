import assert from 'node:assert/strict'
import test from 'node:test'
import { annualSeries, incomeSeries, valueInYear, type IncomeSeries, type StatementRowLike } from '../lib/statement-reading'
import { statementDetailLines } from '../lib/financial-statement-details'

const row = (lineItemId: string, value: number | null, extra: Partial<StatementRowLike> = {}): StatementRowLike => ({
  lineItemId, value, displayLabel: null, currency: 'USD', periodType: 'annual', fiscalYear: 2025, periodEnd: '2025-09-30', ...extra,
})
const read = (rows: StatementRowLike[], id: 'operatingCostsParts' | 'taxesParts' | 'operatingIncomeInside' = 'operatingCostsParts', extra: Partial<IncomeSeries> = {}) => {
  const series = { ...incomeSeries(rows), ...extra }
  return statementDetailLines(series, id, valueInYear(series.revenue, 2025))
}

test('overlapping operating facts remain independent and missing SGA is never reconstructed', () => {
  const details = read([row('revenue', 100), row('research_and_development', 0),
    row('general_and_administrative', 7), row('selling_and_marketing', 5)])
  assert.equal(details.find(r => r.key === 'researchAndDevelopment')?.amount?.value, 0)
  assert.equal(details.find(r => r.key === 'sga')?.amount, null)
  assert.equal(details.find(r => r.key === 'generalAndAdministrative')?.amount?.value, 7)
  assert.equal(details.find(r => r.key === 'sellingAndMarketing')?.amount?.value, 5)
  const withAggregate = read([row('revenue', 100), row('selling_general_and_administrative', 12), row('general_and_administrative', 7)])
  assert.equal(withAggregate.find(r => r.key === 'sga')?.amount?.value, 12)
  assert.equal(withAggregate.find(r => r.key === 'generalAndAdministrative')?.amount?.value, 7)
})

test('tax benefits, zero expenses and distinct interest concepts retain their reported sign/value', () => {
  const details = read([row('revenue', 100), row('income_tax_expense', -2), row('interest_expense', 0),
    row('non_operating_interest_expense', 3), row('interest_income', 4), row('net_interest_income', 9)], 'taxesParts')
  assert.deepEqual(details.map(r => r.amount?.value), [-2, 0, 3, 4, 9, undefined, undefined])
})

test('exact period, annual basis and currency are required; same fiscal label does not permit a fallback', () => {
  const details = read([row('revenue', 100), row('research_and_development', 4, {periodEnd: '2025-12-31'}),
    row('selling_general_and_administrative', 5, {currency: 'EUR'}),
    row('general_and_administrative', 6, {periodType: 'quarterly'}),
    row('selling_and_marketing', 7, {fiscalYear: 2024, periodEnd: '2024-09-30'})])
  assert.ok(details.every(r => r.amount === null && r.sharePoint === null && r.growthPoint === null))
  assert.ok(read([row('research_and_development', 4)]).every(r => r.amount === null))
})

test('only explicit currency-free fractions accompany the matching amount; no division or orphan ratios', () => {
  const details = read([row('revenue', 100), row('research_and_development', 7),
    row('research_and_development_share_of_revenue', .123, {currency: null, source: 'derived_reported_statements'}),
    row('research_and_development_growth_yoy', 0, {currency: null, source: 'derived_reported_statements'}),
    row('selling_general_and_administrative_share_of_revenue', .2, {currency: null})])
  assert.equal(details[0].sharePoint?.value, .123) // Not 7/100.
  assert.equal(details[0].growthPoint?.value, 0)
  assert.equal(details[1].sharePoint, null)
  const wrong = read([row('revenue', 100), row('research_and_development', 7),
    row('research_and_development_share_of_revenue', .07, {currency: 'USD'}),
    row('research_and_development_growth_yoy', .1, {currency: null, periodEnd: '2024-09-30'})])
  assert.equal(wrong[0].sharePoint, null)
  assert.equal(wrong[0].growthPoint, null)
})

test('derived rows cannot fill raw amounts and a latest null does not revive a previous revision', () => {
  const details = read([row('revenue', 100), row('research_and_development', 4, {source: 'derived_reported_statements'}),
    row('selling_general_and_administrative', null), row('selling_general_and_administrative', 5)])
  assert.equal(details[0].amount, null)
  assert.equal(details[1].amount, null)
})

test('unknown/minor units withhold details and all valid history stays selectable', () => {
  for (const currency of [null, 'XXX', 'GBX', 'GBp', 'ZAC', 'ILA']) {
    assert.equal(read([row('revenue', 100, {currency}), row('research_and_development', 5, {currency})])[0].amount, null)
  }
  const rows = Array.from({length: 35}, (_, i) => [row('revenue', 100, {fiscalYear: 1991 + i, periodEnd: `${1991 + i}-09-30`}),
    row('research_and_development', i, {fiscalYear: 1991 + i, periodEnd: `${1991 + i}-09-30`})]).flat()
  const series = incomeSeries(rows)
  assert.equal(series.researchAndDevelopment?.length, 35)
  assert.equal(statementDetailLines(series, 'operatingCostsParts', valueInYear(series.revenue, 1991))[0].amount?.value, 0)
})

test('items inside operating income are named, never summed, and need the exact period and currency', () => {
  const details = read([row('revenue', 100), row('operating_income', 30), row('stock_based_compensation_expense', 6),
    row('restructuring_charges', 2), row('goodwill_impairment', 0, { periodEnd: '2024-09-30', fiscalYear: 2024 })], 'operatingIncomeInside')
  assert.deepEqual(details.map(r => [r.key, r.amount?.value ?? null]),
    [['shareBasedPayExpense', 6], ['restructuringCharges', 2], ['goodwillImpairment', null]])
  // Operating income itself is untouched by the items named beside it.
  assert.equal(valueInYear(incomeSeries([row('operating_income', 30), row('stock_based_compensation_expense', 6)]).operatingIncome, 2025)?.value, 30)
})

test('interest received and interest paid in cash sit beside the interest expense, as reported', () => {
  const cash = [row('interest_paid', -3), row('interest_paid', -9, { periodEnd: '2025-09-30' })] // newest revision first
  const details = read([row('revenue', 100), row('interest_expense', 4), row('investment_interest_income', 1)], 'taxesParts',
    { interestPaid: annualSeries(cash, 'interestPaid') })
  assert.equal(details.find(r => r.key === 'interestExpense')?.amount?.value, 4)
  assert.equal(details.find(r => r.key === 'investmentInterestIncome')?.amount?.value, 1)
  assert.equal(details.find(r => r.key === 'interestPaid')?.amount?.value, -3)
  // The listing provider's interest_income stays its own line.
  assert.equal(details.find(r => r.key === 'interestIncome')?.amount, null)
})
