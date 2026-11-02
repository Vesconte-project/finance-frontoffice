import { capitalHistory } from '../lib/capital-statements'
import type { StatementRowLike } from '../lib/statement-reading'
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

test('buybacks by year: every year of the range, what was spent, what it is worth today and the multiple', async () => {
  const { buybackSummary } = await import('../lib/capital-reading')
  const executions = [
    { id: 'a', date: '2019-03-31', periodStart: null, amount: 100, shares: 10, averagePrice: 10, currency: 'USD' },
    { id: 'b', date: '2019-09-30', periodStart: null, amount: 200, shares: 10, averagePrice: 20, currency: 'USD' },
    { id: 'c', date: '2020-03-31', periodStart: null, amount: 300, shares: null, averagePrice: null, currency: 'USD' },
    { id: 'd', date: '2021-03-31', periodStart: null, amount: 400, shares: 8, averagePrice: 50, currency: 'USD' },
    { id: 'e', date: '2022-03-31', periodStart: null, amount: null, shares: 5, averagePrice: null, currency: 'USD' },
  ]
  const summary = buybackSummary(executions, 40, { fromYear: 2016, toYear: 2022 })!
  assert.deepEqual(summary.years.map((year) => year.year), [2016, 2017, 2018, 2019, 2020, 2021, 2022])
  assert.deepEqual(summary.years[0], { year: 2016, spent: null, worthToday: null, multiple: null }, 'a year with nothing reported stays empty, never a zero')
  assert.deepEqual(summary.years[3], { year: 2019, spent: 300, worthToday: 800, multiple: 800 / 300 })
  assert.equal(summary.years[4].worthToday, null, 'a year without share counts has no value today')
  assert.equal(summary.years[4].multiple, null)
  assert.equal(summary.years[6].spent, null, 'an execution without an amount adds no spending')
  assert.equal(summary.spent, 1000)
  assert.equal(summary.worthToday, null, 'no total value today when a year is missing it')
  assert.deepEqual(summary.recentYears, [2021, 2022])
  assert.equal(summary.recentShare, 0.4)
  assert.equal(buybackSummary([], 40, { fromYear: 2016, toYear: 2022 }), null)
  assert.equal(buybackSummary(executions.slice(0, 2), null, { fromYear: 2016, toYear: 2022 })!.years[3].worthToday, null, 'no price, no value today')
})

test('buybacks are never added across currencies, and shares bought back need every count', async () => {
  const { sharesBoughtBack, singleCurrency } = await import('../lib/capital-reading')
  const usd = { id: 'a', date: '2019-03-31', periodStart: null, amount: 100, shares: 10, averagePrice: 10, currency: 'USD' }
  assert.equal(singleCurrency([usd, { ...usd, id: 'b', currency: null }], 'USD'), true)
  assert.equal(singleCurrency([usd, { ...usd, id: 'b', currency: 'EUR' }], 'USD'), false)
  assert.equal(sharesBoughtBack([usd, { ...usd, id: 'b', shares: 5 }]), 15)
  assert.equal(sharesBoughtBack([usd, { ...usd, id: 'b', shares: null }]), null)
  assert.equal(sharesBoughtBack([]), null)
})

test('the price by year or quarter: each period’s last close and the close it started from', async () => {
  const { pricePeriods } = await import('../lib/capital-reading')
  const points = [
    { date: '2015-12-31', close: 9 },
    { date: '2016-01-04', close: 10 },
    { date: '2016-06-30', close: 12 },
    { date: '2016-12-30', close: 11 },
    { date: '2017-02-01', close: 13 },
  ]
  const years = pricePeriods(points, 'year', '2016-01-01')
  assert.deepEqual(years.map((period) => [period.label, period.startClose, period.endClose]), [['2016', 9, 11], ['2017', 11, 13]])
  assert.equal(years[0].short, "'16")
  const quarters = pricePeriods(points, 'quarter', '2016-01-01')
  assert.deepEqual(quarters.map((period) => period.label), ['Q1 2016', 'Q2 2016', 'Q4 2016', 'Q1 2017'])
  assert.deepEqual([quarters[1].startClose, quarters[1].endClose], [10, 12])
})


function statement(id:string,value:number|null,periodEnd='2025-09-30',extra:Partial<StatementRowLike>={}) {
  return {lineItemId:id,displayLabel:id,value,currency:'EUR',periodType:'annual',fiscalYear:Number(periodEnd.slice(0,4)),periodEnd,
    source:['net_cash','dividends_paid_amount','share_repurchases_amount'].includes(id)?'derived_reported_statements':'yahoo_finance',...extra}
}

test('annual capital facts stay separate from executions, aliases and share issuance',()=>{
  const balance=[statement('cash_and_equivalents',50),statement('total_debt',80),statement('net_cash',-30),statement('shares_outstanding',120),statement('shares_issued',140)]
  const cash=[statement('dividends_paid_amount',12),statement('share_repurchases_amount',20),statement('net_common_stock_issuance',-50),statement('dividends_paid',-12)]
  const facts=capitalHistory(balance,cash)
  assert.deepEqual(facts.cashDebt,[{periodEnd:'2025-09-30',year:2025,cash:50,debt:80,netCash:-30,currency:'EUR'}])
  assert.equal(facts.dividends[0].value,12)
  assert.equal(facts.buybacks[0].value,20)
  assert.equal(facts.shares[0].value,120)
  assert.equal(capitalHistory([], [statement('net_common_stock_issuance',-50)]).buybacks.length,0)
})

test('capital charts require same period and currency, and cannot revive a null latest revision',()=>{
  const rows=[statement('cash_and_equivalents',50),statement('total_debt',10),statement('net_cash',null),statement('net_cash',40)]
  assert.deepEqual(capitalHistory(rows,[]).cashDebt,[])
  assert.deepEqual(capitalHistory([statement('cash_and_equivalents',50),statement('total_debt',10,'2024-09-30'),statement('net_cash',40)],[]).cashDebt,[])
  assert.deepEqual(capitalHistory([statement('cash_and_equivalents',50),statement('total_debt',10,undefined,{currency:'USD'}),statement('net_cash',40)],[]).cashDebt,[])
  assert.deepEqual(capitalHistory([], [statement('share_repurchases_amount',null),statement('share_repurchases_amount',20)]).buybacks,[])
})

test('capital readers only accept canonical derived amounts and never invert raw payments',()=>{
  const rows=[statement('share_repurchases_amount',30,undefined,{source:'fixture'}),statement('dividends_paid',-20)]
  assert.deepEqual(capitalHistory([],rows).buybacks,[])
  assert.deepEqual(capitalHistory([],rows).dividends,[])
  assert.equal(capitalHistory([], [statement('share_repurchases_amount',0)]).buybacks[0].value,0)
})

test('capital money histories stay in the latest currency while share counts do not need currency',()=>{
  const cash=[statement('share_repurchases_amount',20,'2024-09-30',{currency:'USD'}),statement('share_repurchases_amount',30)]
  assert.deepEqual(capitalHistory([],cash).buybacks.map(row=>row.currency),['EUR'])
  assert.deepEqual(capitalHistory([], [statement('dividends_paid_amount',20,undefined,{currency:null})]).dividends,[])
  assert.equal(capitalHistory([statement('shares_outstanding',100,undefined,{currency:null})],[]).shares[0].value,100)
})
