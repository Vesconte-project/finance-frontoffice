import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  absenceCopy,
  formatStandingPercent,
  parseTickerReadings,
  readingVerdicts,
  signedOutReadingVerdict,
} from '../lib/ticker-readings'

// Spec "Ticker reading standings V1", accepted Snapshot
// snap-sha256-1b86aad9c9747594f6169a428af18e28038a9e502c9b1a831d8fa88c34e08e67.

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function ranked(reading: string, position: number, universeSize: number) {
  return { reading, status: 'ranked', standing: { position, universeSize, coverage: 0.9, rawScore: 71 }, absenceReason: null }
}

function absent(reading: string, absenceReason: string) {
  return { reading, status: 'absent', standing: null, absenceReason }
}

function payload(readings: unknown[]) {
  return { ticker: 'AAPL', asOf: '2026-09-22', readings }
}

test('the percentage rule matches every row of the Spec table (§4.3)', () => {
  assert.equal(formatStandingPercent(1, 684), 'Top 1%')
  assert.equal(formatStandingPercent(42, 684), 'Top 7%')
  assert.equal(formatStandingPercent(342, 684), 'Top 50%')
  assert.equal(formatStandingPercent(343, 684), 'Bottom 50%')
  assert.equal(formatStandingPercent(684, 684), 'Bottom 1%')
})

test('the percentage is never below one and a universe of one is the top', () => {
  // A universe of one: position × 2 > 1, so the rule reads it from the bottom.
  assert.equal(formatStandingPercent(1, 1), 'Bottom 100%')
  assert.match(formatStandingPercent(1, 100000), /^Top 1%$/)
  assert.match(formatStandingPercent(100000, 100000), /^Bottom 1%$/)
})

test('every absence reason has its exact Spec string (§6.1)', () => {
  assert.equal(absenceCopy('pays_no_dividend'), 'Pays no dividend')
  assert.equal(absenceCopy('ineligible_asset_type'), 'Not ranked · not a company')
  // Superseded by Spec "Reading eligibility V1" §4.4.
  assert.equal(absenceCopy('insufficient_coverage'), 'Insufficient data')
  assert.equal(absenceCopy('reading_not_materialized'), 'Not available yet')
  assert.equal(absenceCopy('not_tracked'), 'Not tracked')
  assert.equal(absenceCopy('something_new_upstream'), 'Not ranked')
})

test('signed-in rows: three, in order, ranked rows link to Top picks, absent rows do not', () => {
  const parsed = parseTickerReadings(
    payload([ranked('shortTerm', 343, 684), absent('income', 'pays_no_dividend'), ranked('longTerm', 42, 684)])
  )
  assert.ok(parsed)
  const rows = readingVerdicts(parsed)

  assert.deepEqual(
    rows.map((row) => [row.label, row.value, row.href]),
    [
      ['Long term', 'Top 7%', '/picks/long-term'],
      ['Income', 'Pays no dividend', null],
      ['Short term', 'Bottom 50%', '/picks/short-term'],
    ]
  )
})

test('rows never carry the raw score, the coverage or the absolute position', () => {
  const parsed = parseTickerReadings(payload([ranked('longTerm', 42, 684), ranked('income', 7, 500), ranked('shortTerm', 3, 690)]))
  assert.ok(parsed)
  const serialized = JSON.stringify(readingVerdicts(parsed))

  assert.doesNotMatch(serialized, /rawScore|coverage|\b42\b|\b684\b|\b71\b|0\.9/)
})

test('a malformed payload is rejected rather than partly rendered (§4.4)', () => {
  const good = [ranked('longTerm', 1, 10), absent('income', 'pays_no_dividend'), ranked('shortTerm', 2, 10)]
  const cases: unknown[] = [
    null,
    'nope',
    { readings: good },
    payload(good.slice(0, 2)),
    payload([...good, absent('longTerm', 'not_tracked')]),
    payload([good[0], good[0], good[2]]),
    payload([ranked('dividends', 1, 10), good[1], good[2]]),
    payload([{ ...good[0], absenceReason: 'pays_no_dividend' }, good[1], good[2]]),
    payload([{ reading: 'longTerm', status: 'absent', standing: null, absenceReason: null }, good[1], good[2]]),
    payload([ranked('longTerm', 0, 10), good[1], good[2]]),
    payload([ranked('longTerm', 11, 10), good[1], good[2]]),
    payload([ranked('longTerm', 1.5, 10), good[1], good[2]]),
    payload([{ ...good[0], status: 'absent' }, good[1], good[2]]),
  ]
  for (const raw of cases) assert.equal(parseTickerReadings(raw), null, JSON.stringify(raw))
  assert.ok(parseTickerReadings(payload(good)))
})

test('a signed-out reader gets one invitation row and nothing else', () => {
  const row = signedOutReadingVerdict('AAPL')

  assert.deepEqual(
    { label: row.label, value: row.value, detail: row.detail, href: row.href },
    {
      label: 'Readings',
      value: 'Free account',
      detail: 'Create a free account to see where AAPL stands in each reading.',
      href: '/sign-up',
    }
  )
})

test('the Overview does not request /readings: its verdict lines are the two the ticker Spec places there', () => {
  // Founder, 2026-10-05 (Spec PRD-78): beside the chart only the score, the
  // model signal and the technical verdict. The reading standings left the
  // Overview, so the page never asks for them.
  const page = readRepoFile('app/(app)/stocks/[ticker]/page.tsx')
  assert.doesNotMatch(page, /getTickerReadingsPayload|loadReadingVerdicts|readingVerdicts/)
  assert.match(page, /export const dynamic = 'force-dynamic'/)
  const overview = readRepoFile('components/stocks/StockOverviewClient.tsx')
  assert.doesNotMatch(overview, /getTickerReadingsPayload|parseTickerReadings|formatStandingPercent|readingVerdicts/)
})

// Spec "Reading eligibility V1", accepted Snapshot
// snap-sha256-ce95a67c388122e9de7237616d310b4689eb9add1e2c168ba0adc45e689b9401, §4.4.

function insufficient(reading: string, measuredParts?: unknown, missingParts?: unknown) {
  return { ...absent(reading, 'insufficient_coverage'), measuredParts, missingParts }
}

test('insufficient data says what was measured and what is missing', () => {
  const parsed = parseTickerReadings(
    payload([
      insufficient(
        'longTerm',
        [
          { key: 'value', label: 'Price versus peers', required: false },
          { key: 'potential', label: 'Growth', required: false },
        ],
        [{ key: 'health', label: 'Financial health', required: true }]
      ),
      absent('income', 'pays_no_dividend'),
      ranked('shortTerm', 10, 684),
    ])
  )
  assert.ok(parsed)
  const [longTerm, income] = readingVerdicts(parsed)
  assert.equal(longTerm.value, 'Insufficient data')
  assert.equal(longTerm.detail, 'Measured: Price versus peers, Growth · Missing: Financial health (required)')
  assert.equal(longTerm.href, null)
  assert.equal(income.detail, null)
})

test('insufficient data without parts from an older backend shows the value alone', () => {
  const parsed = parseTickerReadings(payload([insufficient('longTerm'), absent('income', 'pays_no_dividend'), ranked('shortTerm', 1, 2)]))
  assert.ok(parsed)
  const [longTerm] = readingVerdicts(parsed)
  assert.equal(longTerm.value, 'Insufficient data')
  assert.equal(longTerm.detail, null)
})

test('malformed parts drop the detail line, not the rows', () => {
  const parsed = parseTickerReadings(
    payload([insufficient('longTerm', [{ key: 'value' }], 'nope'), absent('income', 'pays_no_dividend'), ranked('shortTerm', 1, 2)])
  )
  assert.ok(parsed)
  assert.equal(readingVerdicts(parsed)[0].detail, null)
})

test('nothing measured still names what is missing', () => {
  const parsed = parseTickerReadings(
    payload([
      insufficient('longTerm', [], [
        { key: 'health', label: 'Financial health', required: true },
        { key: 'potential', label: 'Growth', required: false },
      ]),
      absent('income', 'pays_no_dividend'),
      ranked('shortTerm', 1, 2),
    ])
  )
  assert.ok(parsed)
  assert.equal(readingVerdicts(parsed)[0].detail, 'Missing: Financial health (required), Growth')
})
