import assert from 'node:assert/strict'
import test from 'node:test'
import { eligibilitySentence, parseEligibilityRule, readingPartsDetail } from '../lib/reading-eligibility'

// Spec "Reading eligibility V1", accepted Snapshot
// snap-sha256-ce95a67c388122e9de7237616d310b4689eb9add1e2c168ba0adc45e689b9401, §4.4 (D-6).

test('the picks page states the rule in words, not a percentage', () => {
  const rule = parseEligibilityRule({
    required: { key: 'health', label: 'Financial health' },
    anyOf: [
      { key: 'value', label: 'Price versus peers' },
      { key: 'potential', label: 'Growth' },
    ],
  })
  assert.ok(rule)
  const sentence = eligibilitySentence(rule)
  assert.equal(
    sentence,
    'A company is ranked only when its financial health and at least one of price versus peers or growth were measured.'
  )
  assert.doesNotMatch(sentence, /%/)
})

test('the same sentence reads for income and short term', () => {
  const income = parseEligibilityRule({
    required: { key: 'yield', label: 'Yield' },
    anyOf: [{ key: 'coverage', label: 'Cover' }, { key: 'record', label: 'Record' }],
  })
  assert.ok(income)
  assert.equal(eligibilitySentence(income), 'A company is ranked only when its yield and at least one of cover or record were measured.')
})

test('a rule the backend does not send, or sends broken, is null', () => {
  assert.equal(parseEligibilityRule(null), null)
  assert.equal(parseEligibilityRule({ required: { key: 'health' } }), null)
  assert.equal(parseEligibilityRule({ required: { key: 'health', label: 'Financial health' }, anyOf: [] }), null)
  assert.equal(parseEligibilityRule({ required: { key: 'health' }, anyOf: [{ label: 'no key' }] }), null)
})

test('the detail line is empty when there is nothing to say', () => {
  assert.equal(readingPartsDetail(null, null), null)
  assert.equal(readingPartsDetail([], []), null)
})
