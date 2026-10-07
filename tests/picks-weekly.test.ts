import assert from 'node:assert/strict'
import test from 'node:test'
import { WEEKLY_SECTORS, isSectorCutValid, weeklyCutFor, weeksSinceEpoch } from '../lib/picks-weekly'
import { PICK_READING_KEYS } from '../lib/picks-content'

test('the week turns over on Monday 00:00 UTC, not before', () => {
  const sunday = new Date('2026-10-04T23:59:59Z')
  const monday = new Date('2026-10-05T00:00:00Z')
  assert.equal(weeksSinceEpoch(monday) - weeksSinceEpoch(sunday), 1)
  assert.deepEqual(weeklyCutFor(new Date('2026-10-07T12:00:00Z')), weeklyCutFor(monday))
  assert.equal(weeklyCutFor(monday).weekStart, '2026-10-05')
  assert.equal(weeklyCutFor(sunday).weekStart, '2026-09-28')
})

test('every sector runs under every reading once per cycle', () => {
  const cycle = PICK_READING_KEYS.length * WEEKLY_SECTORS.length
  const seen = new Set<string>()
  const start = Date.UTC(2026, 9, 5)
  for (let week = 0; week < cycle; week += 1) {
    const cut = weeklyCutFor(new Date(start + week * 7 * 86_400_000))
    seen.add(`${cut.reading}:${cut.sector}`)
  }
  assert.equal(seen.size, cycle)
})

test('consecutive weeks change the reading', () => {
  const a = weeklyCutFor(new Date('2026-10-05T00:00:00Z'))
  const b = weeklyCutFor(new Date('2026-10-12T00:00:00Z'))
  assert.notEqual(a.reading, b.reading)
})

test('a sector cut is shown only when the backend applied the filter', () => {
  assert.equal(isSectorCutValid('Technology', 'Technology', ['Technology', 'technology']), true)
  // An older backend ignores `sector` and returns the whole market's top ten.
  assert.equal(isSectorCutValid('Technology', null, ['Technology', 'Energy']), false)
  // Echoed, but a row from another sector slipped through.
  assert.equal(isSectorCutValid('Technology', 'Technology', ['Technology', 'Energy']), false)
  assert.equal(isSectorCutValid('Technology', 'Technology', ['Technology', null]), false)
  assert.equal(isSectorCutValid('Technology', 'Energy', ['Energy']), false)
})
