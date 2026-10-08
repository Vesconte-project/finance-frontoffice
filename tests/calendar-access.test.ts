import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { calendarFocus, calendarHref, humanWeek, keepCompanies, readableTitle, resolveCalendarWindow, weekStart } from '../lib/calendar-model'

const TODAY = '2026-10-08' // a Thursday

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

test('weeks run Monday to Sunday', () => {
  assert.equal(weekStart('2026-10-08'), '2026-10-05')
  assert.equal(weekStart('2026-10-05'), '2026-10-05')
  assert.equal(weekStart('2026-10-11'), '2026-10-05')
  assert.equal(weekStart('2026-11-01'), '2026-10-26')
  assert.equal(humanWeek('2026-10-05'), 'Oct 5 – 11, 2026')
  assert.equal(humanWeek('2026-10-26'), 'Oct 26 – Nov 1, 2026')
  assert.equal(humanWeek('2026-12-28'), 'Dec 28, 2026 – Jan 3, 2027')
})

test('a signed-out viewer reads the current week only', () => {
  const open = resolveCalendarWindow({ signedIn: false, today: TODAY })
  assert.deepEqual(
    { view: open.view, start: open.start, end: open.end, locked: open.locked },
    { view: 'week', start: '2026-10-05', end: '2026-10-11', locked: false },
  )
  assert.equal(resolveCalendarWindow({ week: '2026-10-07', signedIn: false, today: TODAY }).locked, false)
  assert.equal(resolveCalendarWindow({ week: '2026-10-12', signedIn: false, today: TODAY }).locked, true)
  assert.equal(resolveCalendarWindow({ week: '2026-09-28', signedIn: false, today: TODAY }).locked, true)
  assert.equal(resolveCalendarWindow({ view: 'month', signedIn: false, today: TODAY }).locked, true)
  assert.equal(resolveCalendarWindow({ view: 'month', month: '2026-10', signedIn: false, today: TODAY }).locked, true)
})

test('a signed-in viewer reads any week and the month view', () => {
  const next = resolveCalendarWindow({ week: '2026-10-14', signedIn: true, today: TODAY })
  assert.deepEqual({ start: next.start, end: next.end, locked: next.locked }, { start: '2026-10-12', end: '2026-10-18', locked: false })
  const month = resolveCalendarWindow({ view: 'month', month: '2026-11', signedIn: true, today: TODAY })
  assert.deepEqual({ view: month.view, start: month.start, end: month.end, locked: month.locked }, { view: 'month', start: '2026-11-01', end: '2026-11-30', locked: false })
})

test('malformed input falls back to the current week', () => {
  for (const week of ['2026-13-01', '2026-02-30', 'next', '']) {
    const shown = resolveCalendarWindow({ week, signedIn: false, today: TODAY })
    assert.equal(shown.start, '2026-10-05')
    assert.equal(shown.locked, false)
  }
  assert.equal(resolveCalendarWindow({ view: 'year', signedIn: true, today: TODAY }).view, 'week')
})

test('calendar links keep the view and the week', () => {
  assert.equal(calendarHref({ category: 'all', view: 'week', week: '2026-10-05' }), '/calendar?week=2026-10-05')
  assert.equal(calendarHref({ category: 'earnings', view: 'month', month: '2026-10', day: '2026-10-08' }), '/calendar/earnings?view=month&month=2026-10&day=2026-10-08')
  assert.equal(readableTitle('cash_dividend ex-date'), 'Cash dividend ex-date')
})

test('a locked window is never fetched and the full index stays on the server', () => {
  const landing = readRepoFile('components/calendar/CalendarLanding.tsx')
  assert.match(landing, /shown\.locked \? Promise\.resolve\(null\) : getPublicCalendarRange\(shown, category\)/)
  assert.match(readRepoFile('lib/calendar-names.ts'), /^import 'server-only'/)
  // The month grid no longer shows a bare count without saying what it counts.
  assert.doesNotMatch(readRepoFile('components/calendar/EventCalendar.tsx'), /styles\.count/)
})

test('the companies filter reads only a watchlist or a well-formed ticker', () => {
  assert.deepEqual(calendarFocus({ list: 'watchlist' }), { list: 'watchlist' })
  assert.deepEqual(calendarFocus({ around: ' lly ' }), { around: 'LLY' })
  assert.deepEqual(calendarFocus({ around: 'TCS.NS' }), { around: 'TCS.NS' })
  for (const around of ['', '<script>', 'A B', 'X'.repeat(20)]) assert.deepEqual(calendarFocus({ around }), {})
  assert.equal(calendarHref({ category: 'earnings', view: 'week', week: '2026-10-05', focus: { around: 'LLY' } }), '/calendar/earnings?around=LLY&week=2026-10-05')
})

test('narrowing keeps the named companies and every economic release', () => {
  const events = [
    { id: '1', symbol: 'LLY' },
    { id: '2', symbol: 'NVO' },
    { id: '3', symbol: 'AAPL' },
    { id: '4', symbol: null },
  ]
  assert.deepEqual(keepCompanies(events, null).map((event) => event.id), ['1', '2', '3', '4'])
  assert.deepEqual(keepCompanies(events, new Set(['LLY', 'NVO'])).map((event) => event.id), ['1', '2', '4'])
  // The watchlist comes from the viewer's own session, read on the server.
  assert.match(readRepoFile('lib/calendar-focus.ts'), /^import 'server-only'/)
  assert.match(readRepoFile('components/calendar/CalendarLanding.tsx'), /keepCompanies\(fetched\.events, kept\)/)
})
