import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  HISTORY_ALLOWANCE,
  clampStart,
  cutStatementHistory,
  latestStart,
  lockedHistoryCopy,
  startCentredOn,
  startForKey,
  windowSize,
  windowValueText,
} from '../lib/statement-history'

// Spec "Financial statements history by plan V1", accepted Snapshot
// snap-sha256-40c3bc89ff96b1c945a6cd46961c34d4421c4f156a6052f7e1cb8ae12284b893.

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

type Row = { lineItemId: string; periodEnd: string; value: number; fiscalYear: number }

function years(first: number, last: number, lineItemId: string, valueBase: number): Row[] {
  const rows: Row[] = []
  for (let year = first; year <= last; year += 1) {
    rows.push({ lineItemId, periodEnd: `${year}-12-31`, value: valueBase + year, fiscalYear: year })
  }
  return rows
}

function payload(rows: Row[], extra: Record<string, unknown> = {}) {
  return { available: true, reason: null, symbol: 'AAPL', count: rows.length, rows, ...extra }
}

function bundle(income: Row[], balance: Row[] = [], cashFlow: Row[] = []) {
  return {
    income: payload(income),
    'balance-sheet': balance.length ? payload(balance) : null,
    'cash-flow': cashFlow.length ? payload(cashFlow) : null,
  }
}

test('the allowance per tier and period type is exactly the Spec table', () => {
  assert.deepEqual(HISTORY_ALLOWANCE, {
    anonymous: { annual: 4, quarterly: 16 },
    free: { annual: 8, quarterly: 32 },
    pro: { annual: null, quarterly: null },
  })
})

test('each tier keeps the most recent periods and counts the rest as withheld', () => {
  const statements = bundle(years(2006, 2025, 'revenue', 1000))

  const anonymous = cutStatementHistory(statements, 'anonymous', 'annual')
  assert.deepEqual(anonymous.statements.income?.rows.map((row) => row.fiscalYear), [2022, 2023, 2024, 2025])
  assert.equal(anonymous.withheld, 16)

  const free = cutStatementHistory(statements, 'free', 'annual')
  assert.equal(free.statements.income?.rows.length, 8)
  assert.equal(free.statements.income?.rows[0].fiscalYear, 2018)
  assert.equal(free.withheld, 12)

  const pro = cutStatementHistory(statements, 'pro', 'annual')
  assert.equal(pro.statements.income?.rows.length, 20)
  assert.equal(pro.withheld, 0)
})

test('quarterly allowances count quarters', () => {
  const rows: Row[] = []
  for (let year = 2011; year <= 2025; year += 1) {
    for (const month of ['03-31', '06-30', '09-30', '12-31']) {
      rows.push({ lineItemId: 'revenue', periodEnd: `${year}-${month}`, value: year, fiscalYear: year })
    }
  }
  assert.equal(cutStatementHistory(bundle(rows), 'anonymous', 'quarterly').withheld, 60 - 16)
  assert.equal(cutStatementHistory(bundle(rows), 'free', 'quarterly').withheld, 60 - 32)
  assert.equal(cutStatementHistory(bundle(rows), 'pro', 'quarterly').withheld, 0)
})

test('a period is a periodEnd across all three statements, so they stop at the same one', () => {
  // The balance sheet reaches a year further back than the income statement.
  const cut = cutStatementHistory(
    bundle(years(2019, 2025, 'revenue', 0), years(2018, 2025, 'total_assets', 0), years(2020, 2025, 'free_cash_flow', 0)),
    'anonymous',
    'annual',
  )
  for (const payloadAfter of Object.values(cut.statements)) {
    assert.deepEqual([...new Set(payloadAfter?.rows.map((row) => row.fiscalYear))], [2022, 2023, 2024, 2025])
  }
  // 2018 through 2021: four distinct periods, not a sum over statements.
  assert.equal(cut.withheld, 4)
  // Each statement is only told about the withheld periods it has rows for.
  assert.deepEqual(cut.withheldBy, { income: 3, 'balance-sheet': 4, 'cash-flow': 2 })
})

test('nothing is withheld, and nothing is locked, when a company holds less than the allowance', () => {
  const cut = cutStatementHistory(bundle(years(2020, 2025, 'revenue', 0)), 'free', 'annual')
  assert.equal(cut.withheld, 0)
  assert.equal(cut.statements.income?.rows.length, 6)
  assert.equal(lockedHistoryCopy('free', 'annual', cut.withheld), null)
})

test('no withheld value, date or label survives the cut', () => {
  const statements = bundle(years(2006, 2025, 'revenue', 7_000_000), years(2006, 2025, 'total_assets', 9_000_000))
  const cut = cutStatementHistory(statements, 'anonymous', 'annual')
  const shipped = JSON.stringify(cut)
  for (let year = 2006; year <= 2021; year += 1) {
    assert.equal(shipped.includes(`${year}-12-31`), false, `period end ${year} leaked`)
    assert.equal(shipped.includes(`"fiscalYear":${year}`), false, `fiscal year ${year} leaked`)
    assert.equal(shipped.includes(String(7_000_000 + year)), false, `income value for ${year} leaked`)
    assert.equal(shipped.includes(String(9_000_000 + year)), false, `balance value for ${year} leaked`)
  }
  // The input is not mutated, so the caller's discarding it is what matters.
  assert.equal(statements.income.rows.length, 20)
})

test('a truncated response counts no withheld periods beyond what was received', () => {
  const statements = {
    income: payload(years(2016, 2025, 'revenue', 0), { truncated: true }),
    'balance-sheet': null,
    'cash-flow': null,
  }
  const cut = cutStatementHistory(statements, 'anonymous', 'annual')
  assert.equal(cut.withheld, 6)
  assert.equal(cut.statements.income?.truncated, true)
})

test('unavailable and missing statements neither add periods nor break the cut', () => {
  const cut = cutStatementHistory(
    {
      income: payload(years(2016, 2025, 'revenue', 0)),
      'balance-sheet': { available: false, reason: 'not covered', symbol: 'AAPL', count: 0, rows: years(1990, 1999, 'total_assets', 0) },
      'cash-flow': null,
    },
    'anonymous',
    'annual',
  )
  assert.equal(cut.withheld, 6)
  assert.deepEqual(cut.withheldBy, { income: 6, 'balance-sheet': 0, 'cash-flow': 0 })
  assert.equal(cut.statements['cash-flow'], null)
  assert.equal(cut.statements['balance-sheet']?.reason, 'not covered')
})

test('locked copy follows §6.1, singular and plural', () => {
  assert.deepEqual(lockedHistoryCopy('anonymous', 'annual', 6), {
    heading: '+6 earlier years',
    body: 'A free account opens 8 years of statements.',
    linkLabel: 'Create a free account',
    href: '/sign-up',
    analyticsId: 'financials_history_sign_up',
  })
  assert.equal(lockedHistoryCopy('anonymous', 'annual', 1)?.heading, '+1 earlier year')
  assert.equal(lockedHistoryCopy('free', 'quarterly', 1)?.heading, '+1 earlier quarter')
  assert.deepEqual(lockedHistoryCopy('free', 'quarterly', 12), {
    heading: '+12 earlier quarters',
    body: 'Full statement history is planned for Pro.',
    linkLabel: 'See plans',
    href: '/pricing',
    analyticsId: null,
  })
  assert.equal(lockedHistoryCopy('anonymous', 'annual', 0), null)
  assert.equal(lockedHistoryCopy('pro', 'annual', 3), null)
})

test('the window is 5 annual or 8 quarterly periods, 3 or 4 on narrow screens', () => {
  assert.equal(windowSize('annual', true), 5)
  assert.equal(windowSize('quarterly', true), 8)
  assert.equal(windowSize('annual', false), 3)
  assert.equal(windowSize('quarterly', false), 4)
})

test('the window opens on the most recent periods and never leaves the allowed ones', () => {
  assert.equal(latestStart(8, 5), 3)
  assert.equal(latestStart(3, 5), 0)
  assert.equal(clampStart(-4, 8, 5), 0)
  assert.equal(clampStart(9, 8, 5), 3)
  assert.equal(startCentredOn(0, 8, 5), 0)
  assert.equal(startCentredOn(4, 8, 5), 2)
  assert.equal(startCentredOn(7, 8, 5), 3)
  // A click in the muted segment arrives as a negative index and stops at the oldest allowed.
  assert.equal(startCentredOn(-6, 8, 5), 0)
})

test('the slider answers to every key in §4.3 and ignores the rest', () => {
  const total = 20
  const size = 5
  assert.equal(startForKey('ArrowLeft', 10, total, size), 9)
  assert.equal(startForKey('ArrowRight', 10, total, size), 11)
  assert.equal(startForKey('PageUp', 10, total, size), 5)
  assert.equal(startForKey('PageDown', 10, total, size), 15)
  assert.equal(startForKey('Home', 10, total, size), 0)
  assert.equal(startForKey('End', 3, total, size), 15)
  assert.equal(startForKey('ArrowLeft', 0, total, size), 0)
  assert.equal(startForKey('ArrowRight', 15, total, size), 15)
  assert.equal(startForKey('PageUp', 2, total, size), 0)
  assert.equal(startForKey('PageDown', 13, total, size), 15)
  assert.equal(startForKey('Tab', 10, total, size), null)
  assert.equal(startForKey('ArrowUp', 10, total, size), null)
})

test('the slider names the first and last period shown', () => {
  const annual = ['FY2017', 'FY2018', 'FY2019', 'FY2020', 'FY2021', 'FY2022', 'FY2023']
  assert.equal(windowValueText(annual, 2, 5), 'FY2019 to FY2023')
  const quarterly = ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025']
  assert.equal(windowValueText(quarterly, 0, 8), 'Q1 2024 to Q4 2025')
  assert.equal(windowValueText(['FY2025'], 0, 1), 'FY2025')
})

test('the page cuts on the server before rendering, from the live session', () => {
  const page = readRepoFile('app/(app)/stocks/[ticker]/financials/page.tsx')
  assert.match(page, /getViewerAccess\(\)/)
  assert.match(page, /tierFor\(viewer\)/)
  assert.match(page, /cutStatementHistory\(/)
  assert.doesNotMatch(page, /'use client'/)
  // The uncut payloads are never handed to the component.
  assert.doesNotMatch(page, /statements=\{\{/)
  assert.match(page, /statements=\{statements\}/)
})

test('the scrubber honours reduced motion and uses the existing glass thumb tokens', () => {
  const css = readRepoFile('components/stocks/ResearchViews.module.css')
  assert.match(css, /\.historyThumb \{[^}]*var\(--glass-thumb-bg\)[^}]*\}/)
  assert.match(css, /\.historyThumb \{[^}]*var\(--glass-thumb-border\)[^}]*\}/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.historyThumb \{\s*transition: none;/)
  const client = readRepoFile('components/stocks/StatementHistoryWindow.tsx')
  assert.match(client, /role="slider"/)
  assert.match(client, /aria-label="Periods shown"/)
  assert.match(client, /aria-valuetext=\{windowValueText\(/)
})
