import assert from 'node:assert/strict'
import test from 'node:test'
import { daysBetween, laneY, timelineGeometry, timelineWindow, type TimelineEvent } from '../lib/event-timeline'
import { earningsChart, hasMeasure, reportedColumns, type EarningsObservation } from '../lib/earnings-chart'
import { describeFiling, filingCode } from '../lib/filing-labels'
import { eventDetails, formatAmount } from '../lib/event-details'

const TODAY = '2026-11-05'

function closes(days: number) {
  const out: Array<{ date: string; close: number }> = []
  for (let i = days; i >= 0; i -= 1) {
    const date = new Date(Date.parse(`${TODAY}T00:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10)
    out.push({ date, close: 100 + i * 0.1 })
  }
  return out
}

test('the window runs back by the range and forward to the last scheduled event, between a month and a year', () => {
  assert.deepEqual(timelineWindow('1Y', TODAY, []), { start: '2025-11-05', end: '2026-12-05' })
  const soon: TimelineEvent = { id: 'e', date: '2027-01-28', category: 'earnings', title: 'Results' }
  assert.equal(timelineWindow('2Y', TODAY, [soon]).end, '2027-02-11')
  const far: TimelineEvent = { ...soon, date: '2029-01-01' }
  assert.equal(timelineWindow('5Y', TODAY, [far]).end, '2027-11-05')
  assert.equal(daysBetween(TODAY, '2027-01-28'), 84)
})

test('events sit on their own day, past ones on the price, scheduled ones after today', () => {
  const past: TimelineEvent[] = [
    { id: 'a', date: '2026-07-30', category: 'earnings', title: 'Results' },
    { id: 'b', date: '2026-07-31', category: 'dividends', title: 'Dividend' },
    { id: 'old', date: '2020-01-01', category: 'company', title: 'Outside the window' },
  ]
  const upcoming: TimelineEvent[] = [{ id: 'n', date: '2027-01-28', category: 'earnings', title: 'Next results' }]
  const geometry = timelineGeometry({ closes: closes(800), past, upcoming, range: '1Y', today: TODAY, width: 1000, height: 360, gap: 24 })
  assert.deepEqual(geometry.events.map((event) => event.id), ['a', 'b', 'n'])
  const [a, b, n] = geometry.events
  assert.ok(a.x < b.x && b.x < geometry.todayX && geometry.todayX < n.x)
  // A day apart is closer than the gap: they stack instead of overlapping.
  assert.notEqual(a.level, b.level)
  assert.ok(a.y !== null && n.y === null)
  assert.equal(n.upcoming, true)
  assert.equal(n.daysAway, 84)
  // Rising closes back in time means each session falls: the next-session move is negative.
  assert.ok(a.nextSession !== null && a.nextSession < 0)
  assert.equal(n.nextSession, null)
  // Markers stay in the lanes above the price.
  for (const event of geometry.events) assert.ok(laneY(geometry, event.level) < geometry.plotTop)
  assert.ok(geometry.line.startsWith('M '))
  assert.ok(geometry.ticks.length > 3)
})

test('without prices the events still have a place', () => {
  const geometry = timelineGeometry({
    closes: [], past: [{ id: 'a', date: '2026-07-30', category: 'earnings', title: 'Results' }], upcoming: [],
    range: '1Y', today: TODAY, width: 600, height: 460, gap: 38,
  })
  assert.equal(geometry.line, '')
  assert.equal(geometry.events.length, 1)
  assert.equal(geometry.events[0].y, null)
})

const ROW: EarningsObservation = {
  earningsDate: '2026-07-30', fiscalPeriod: '2026Q3', epsActual: 2, epsEstimate: 1.8, epsSurprisePct: null,
  revenueActual: null, revenueEstimate: null, revenueSurprisePct: null,
}

test('results are placed against the estimate, oldest first, with no amount computed', () => {
  const rows: EarningsObservation[] = [
    ROW,
    { ...ROW, earningsDate: '2026-04-30', fiscalPeriod: '2026Q2', epsActual: 1.3, epsEstimate: 1.4 },
    { ...ROW, earningsDate: '2026-01-29', fiscalPeriod: '2026Q1', epsActual: null, epsEstimate: 1.2 },
  ]
  const chart = earningsChart(rows, 'eps', { width: 1000, height: 300 })
  assert.deepEqual(chart.quarters.map((quarter) => quarter.label), ['2026Q1', '2026Q2', '2026Q3'])
  assert.deepEqual(chart.quarters.map((quarter) => quarter.direction), [null, 'below', 'above'])
  const q3 = chart.quarters[2]
  assert.ok(q3.actualY! < q3.estimateY!)
  assert.ok(chart.low <= 1.2 && chart.high >= 2)
  assert.ok(Object.keys(q3).every((key) => !/diff|gap|delta/i.test(key)))
  assert.equal(earningsChart(rows, 'eps', { width: 600, height: 340 }, 2).quarters.length, 2)
})

test('a measure or column the source does not carry is left out', () => {
  assert.equal(hasMeasure([ROW], 'eps'), true)
  assert.equal(hasMeasure([ROW], 'revenue'), false)
  assert.deepEqual(reportedColumns([ROW]), {
    epsActual: true, epsEstimate: true, epsSurprise: false, revenueActual: false, revenueEstimate: false, revenueSurprise: false,
  })
})

test('filings get plain names and never show a file name as a title', () => {
  assert.equal(filingCode('FORM 4'), '4')
  assert.equal(filingCode('SCHEDULE_13G'), 'SCHEDULE 13G')
  assert.deepEqual(describeFiling('10-Q', '10-Q'), { label: 'Quarterly report', group: 'results', code: '10-Q', detail: null })
  assert.deepEqual(describeFiling('4', 'FORM 4'), { label: 'Insider trade', group: 'insiders', code: '4', detail: null })
  assert.deepEqual(describeFiling('144', 'xsl144X01/primary_doc.xml'), { label: 'Planned insider sale', group: 'insiders', code: '144', detail: null })
  assert.deepEqual(describeFiling('SCHEDULE 13G/A', 'xslSCHEDULE_13G_X02/primary_doc.xml'),
    { label: 'Large holder over 5% (amended)', group: 'holders', code: 'SCHEDULE 13G/A', detail: null })
  assert.deepEqual(describeFiling('PX14A6G', 'NATIONAL LEGAL AND POLICY CENTER - PX14A6G'),
    { label: 'Shareholder campaign notice', group: 'meetings', code: 'PX14A6G', detail: 'NATIONAL LEGAL AND POLICY CENTER' })
  assert.deepEqual(describeFiling('XYZ-9', 'Something filed'), { label: 'XYZ-9', group: 'other', code: 'XYZ-9', detail: 'Something filed' })
  assert.deepEqual(describeFiling(null, null), { label: 'Filing', group: 'other', code: null, detail: null })
})

test('a chosen event says what the page already knows about it, as reported', () => {
  const events: TimelineEvent[] = [
    { id: 'r', date: '2026-07-30', category: 'earnings', title: 'Results' },
    { id: 'd', date: '2026-08-10', category: 'dividends', title: 'Dividend ex-date' },
    { id: 's', date: '2026-06-01', category: 'company', title: 'Stock split' },
    { id: 'n', date: '2027-01-28', category: 'earnings', title: 'Next results' },
  ]
  const details = eventDetails(events, {
    today: TODAY,
    earnings: [{ ...ROW, earningsDate: '2026-07-31' }],
    next: { date: '2027-01-28', fiscalPeriod: '2027Q1', epsEstimate: 2.9, revenueEstimate: null },
    actions: [
      { eventId: 'x', symbol: 'Q', actionType: 'dividend', exDate: '2026-08-10', paymentDate: '2026-08-14', recordDate: '2026-08-11',
        declarationDate: null, cashAmount: 0.265, adjustedCashAmount: 0.265, frequency: 'quarterly', currency: 'USD', knownAt: null, source: null, methodologyVersion: null },
      { eventId: 'y', symbol: 'Q', actionType: 'split', exDate: '2026-06-01', paymentDate: null, splitRatioText: '4-for-1',
        cashAmount: null, adjustedCashAmount: null, frequency: null, currency: null, knownAt: null, source: null, methodologyVersion: null },
    ],
    documents: [{ date: '2026-07-30', label: 'Current report', url: 'https://example.com/8k' }],
    closes: closes(400),
    currency: 'USD',
    compactMoney: (value) => `$${value}`,
  })
  const facts = (id: string) => Object.fromEntries(details[id].facts.map((fact) => [fact.label, fact.value]))
  // Results a day apart from the event still match their quarter.
  assert.equal(facts('r').Period, '2026Q3')
  assert.equal(facts('r')['EPS reported'], '2')
  assert.equal(facts('r')['EPS estimate'], '1.8')
  assert.equal(facts('r')['EPS surprise'], undefined)
  assert.equal(details.r.documents[0].label, 'Current report')
  assert.equal(facts('d')['Amount per share'], '$0.265')
  assert.equal(facts('d').Paid, 'Aug 14, 2026')
  assert.equal(facts('d')['Record date'], 'Aug 11, 2026')
  assert.equal(facts('d').Frequency, 'Quarterly')
  assert.equal(facts('s')['Split ratio'], '4-for-1')
  assert.ok(facts('d')['Close that day'])
  // Scheduled: the estimates, and no close that has not happened.
  assert.deepEqual(facts('n'), { Period: '2027Q1', 'EPS estimate': '2.9' })
  assert.equal(formatAmount(1234.5, 'EUR'), '€1,234.50')
})
