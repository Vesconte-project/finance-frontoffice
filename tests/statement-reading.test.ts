import assert from 'node:assert/strict'
import test from 'node:test'
import { barLayout, labelledIndexes, sparseAxis } from '../lib/reported-bars'
import {
  annualSeries,
  dividendHistory,
  incomeSeries,
  reportedYears,
  shortYear,
  summaryAmount,
  summaryPercent,
  valueInYear,
  type StatementRowLike,
} from '../lib/statement-reading'

function row(lineItemId: string, year: number, value: number | null, extra: Partial<StatementRowLike> = {}): StatementRowLike {
  return {
    lineItemId,
    displayLabel: null,
    value,
    currency: 'USD',
    periodType: 'annual',
    fiscalYear: year,
    periodEnd: `${year}-09-30`,
    ...extra,
  }
}

test('a measure is the reported annual series, oldest first, one value per period', () => {
  const rows = [
    row('revenue', 2025, 400),
    row('revenue', 2025, 390), // an older revision of the same period, ordered after the newest
    row('revenue', 2023, 380),
    row('revenue', 2024, 390),
    row('revenue', 2022, null),
    row('revenue', 2024, 100, { periodType: 'quarterly', periodEnd: '2024-06-30' }),
  ]
  const series = annualSeries(rows, 'revenue')
  assert.deepEqual(series.map((point) => [point.year, point.value]), [[2023, 380], [2024, 390], [2025, 400]])
})

test('exact line item ids win; labels are the fallback and exclude look-alikes', () => {
  const rows = [
    row('cost_of_revenue', 2025, 200, { displayLabel: 'Cost of Revenue' }),
    row('total_revenue_as_reported', 2025, 410, { displayLabel: 'Total Revenue' }),
  ]
  assert.deepEqual(annualSeries(rows, 'revenue').map((point) => point.value), [410])
  const exact = [...rows, row('revenue', 2025, 400)]
  assert.deepEqual(annualSeries(exact, 'revenue').map((point) => point.value), [400])
  assert.deepEqual(annualSeries([row('operating_margin', 2025, 0.3, { displayLabel: 'Operating Margin' })], 'operatingIncome'), [])
})

test('the flow years are the newest reported ones, and nothing is derived', () => {
  const rows = [
    ...[2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => row('revenue', year, 100 + year)),
    row('gross_profit', 2025, 180),
    row('operating_income', 2025, 120),
    row('net_income', 2025, -10),
  ]
  const series = incomeSeries(rows)
  assert.deepEqual(reportedYears(series, 5), [2025, 2024, 2023, 2022, 2021])
  assert.equal(valueInYear(series.netIncome, 2025)?.value, -10)
  assert.equal(valueInYear(series.grossProfit, 2024), null)
  assert.equal(shortYear(2025), "'25")
  // The series carries only what was reported: no growth or margin fields.
  assert.deepEqual(Object.keys(series.revenue[0]).sort(), ['currency', 'periodEnd', 'value', 'year'])
})

test('dividends are reported payments by ex-date over ten years, never mixing adjusted and paid amounts', () => {
  const rows = [
    { actionType: 'dividend', exDate: '2026-08-10', cashAmount: 0.26, adjustedCashAmount: 0.26, currency: 'USD' },
    { actionType: 'dividend', exDate: '2026-05-10', cashAmount: 0.25, adjustedCashAmount: 0.25, currency: 'USD' },
    { actionType: 'dividend', exDate: '2026-05-10', cashAmount: 0.2, adjustedCashAmount: 0.2, currency: 'USD' }, // same day: first wins
    { actionType: 'split', exDate: '2020-08-31', cashAmount: null, adjustedCashAmount: null, currency: null },
    { actionType: 'dividend', exDate: '2016-01-01', cashAmount: 0.5, adjustedCashAmount: 0.125, currency: 'USD' }, // outside ten years
    { actionType: 'dividend', exDate: '2026-11-10', cashAmount: 0.27, adjustedCashAmount: 0.27, currency: 'USD' }, // future
  ]
  const history = dividendHistory(rows, '2026-10-04')
  assert.equal(history.adjusted, true)
  assert.deepEqual(history.payments.map((payment) => [payment.exDate, payment.amount]), [['2026-05-10', 0.25], ['2026-08-10', 0.26]])

  const partlyAdjusted = dividendHistory([
    { actionType: 'dividend', exDate: '2019-05-10', cashAmount: 0.8, adjustedCashAmount: null, currency: 'USD' },
    { actionType: 'dividend', exDate: '2025-05-10', cashAmount: 0.25, adjustedCashAmount: 0.25, currency: 'USD' },
  ], '2026-10-04')
  assert.equal(partlyAdjusted.adjusted, false)
  assert.deepEqual(partlyAdjusted.payments.map((payment) => payment.amount), [0.8, 0.25])
  assert.deepEqual(dividendHistory([], '2026-10-04'), { payments: [], adjusted: false })
})

test('summary figures are read as the Overview reads them', () => {
  const rows = [
    { metric: 'operating_margin', metricLabel: 'Operating Margin', valueNumber: 0.3123 },
    { metric: 'net_margin', metricLabel: 'Net Margin', valueNumber: 24.1 },
    { metric: 'net_cash', metricLabel: 'Net Cash', valueNumber: -1.5e9 },
    { metric: 'gross_margin', metricLabel: 'Gross Margin', valueNumber: null },
  ]
  assert.ok(Math.abs((summaryPercent(rows, /operating\s+margin/i) ?? 0) - 31.23) < 1e-9)
  assert.equal(summaryPercent(rows, /net\s+(profit\s+)?margin/i), 24.1)
  assert.equal(summaryPercent(rows, /gross\s+margin/i), null)
  assert.equal(summaryAmount(rows, /^net\s+cash\b/i), -1.5e9)
  assert.equal(summaryAmount(rows, /free cash flow/i), null)
})

test('bars start from zero and losses hang below it', () => {
  const box = { width: 600, height: 250 }
  const layout = barLayout([100, -50, 200], box)
  const [first, loss, last] = layout.bars
  assert.ok(first.y + first.height <= layout.zeroY + 1e-9)
  assert.ok(loss.negative && Math.abs(loss.y - layout.zeroY) < 1e-9)
  assert.ok(last.height > first.height)
  assert.ok(Math.abs(last.height / first.height - 2) < 1e-9, 'heights are proportional to the values')
  assert.ok(layout.bars.every((bar) => bar.x >= 0 && bar.x + bar.width <= box.width))
  const positive = barLayout([10, 20], box)
  assert.ok(Math.abs(positive.zeroY - (box.height - 30)) < 1e-9, 'all-positive bars stand on the bottom line')
})

test('crowded charts write the ends and the picked bar, and thin out their names', () => {
  assert.deepEqual([...labelledIndexes(5, 'all')], [0, 1, 2, 3, 4])
  assert.deepEqual([...labelledIndexes(40, 'ends', [12])].sort((a, b) => a - b), [0, 12, 39])
  assert.deepEqual([...labelledIndexes(0, 'ends')], [])
  const names = sparseAxis(10, 5)
  assert.ok(names.has(9), 'the latest name is always shown')
  assert.ok(names.size <= 5)
  assert.equal(sparseAxis(4, 5).size, 4)
})
