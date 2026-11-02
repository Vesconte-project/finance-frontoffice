import assert from 'node:assert/strict'
import test from 'node:test'
import type { CheckKey, CheckState, EvidenceChange, EvidenceCheck } from '../lib/model-lab/contract'
import { describeChange, describeChecks } from '../lib/model-lab/read-back'

const KEYS: CheckKey[] = ['costs', 'periods', 'robust', 'recent', 'baseline']
const checks = (...states: CheckState[]): EvidenceCheck[] => states.map((state, i) => ({ key: KEYS[i], title: `Check ${i + 1}`, state, line: '', why: '' }))
const change = (previousHolding: number, currentHolding: number, movedCheck: CheckKey | null): EvidenceChange => ({ previousHolding, currentHolding, movedCheck, asOf: '2026-10-14' })

test('every check holding reads as all of them', () => {
  assert.equal(describeChecks(checks('holds', 'holds', 'holds', 'holds', 'holds')), 'All 5 checks hold.')
})

test('none holding reads as none, with no judgement added', () => {
  assert.equal(describeChecks(checks('fails', 'partly', 'fails', 'partly', 'fails')), 'None of the checks hold.')
})

test('a mix names what holds and what is shakier', () => {
  assert.equal(describeChecks(checks('holds', 'holds', 'partly', 'holds', 'fails')), 'It holds up on costs, different periods and recent months. It is shakier on small changes and the simple rule.')
  assert.equal(describeChecks(checks('holds', 'partly', 'partly', 'partly', 'partly')), 'It holds up on costs. It is shakier on different periods, small changes, recent months and the simple rule.')
})

test('no change says so and gives the date', () => {
  const r = describeChange(change(3, 3, null), checks('holds', 'holds', 'holds', 'partly', 'partly'), '14 Oct 2026')
  assert.equal(r.headline, 'Nothing moved since the last test.')
  assert.ok(r.detail.includes('14 Oct 2026'))
})

test('a change states the counts and names the check that moved', () => {
  const r = describeChange(change(4, 3, 'recent'), checks('holds', 'holds', 'holds', 'partly', 'holds'), '14 Oct 2026')
  assert.equal(r.headline, '4 of 5 checks held last time, 3 hold now.')
  assert.ok(r.detail.includes('“Check 4”') && r.detail.includes('recent months'))
})

test('a verdict word never appears in these sentences', () => {
  const all = [describeChecks(checks('holds', 'holds', 'partly', 'holds', 'fails')), describeChange(change(2, 4, 'costs'), checks('holds', 'holds', 'holds', 'holds', 'partly'), 'x').headline].join(' ').toLowerCase()
  for (const word of ['strong', 'weak', 'good', 'bad', 'promising', 'recommend']) assert.ok(!all.includes(word), word)
})
