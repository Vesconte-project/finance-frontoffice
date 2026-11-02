import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BENCHMARK_OPTIONS,
  CONDITION_OPTIONS,
  DEFAULT_SENTENCE,
  DOES_OPTIONS,
  UNIVERSE_OPTIONS,
  WHO_OPTIONS,
  countVariants,
  describeThesis,
  doesNeedsBenchmark,
  horizonText,
  horizonsText,
  isComparingSeveral,
  optionText,
  type ThesisSentence,
} from '../lib/model-lab/thesis-sentence'

const sentence = (patch: Partial<ThesisSentence>): ThesisSentence => ({ ...DEFAULT_SENTENCE, ...patch })

test('the default sentence reads back as written', () => {
  assert.equal(
    describeThesis(DEFAULT_SENTENCE),
    'Among my whole watchlist, recent winners will outperform the market over two weeks'
  )
})

test('a condition is added after the verb, and "any conditions" adds nothing', () => {
  assert.equal(
    describeThesis(sentence({ condition: 'falling' })),
    'Among my whole watchlist, recent winners will outperform the market when the market is falling over two weeks'
  )
  assert.ok(!describeThesis(sentence({ condition: 'any' })).includes('conditions'))
})

test('verbs without a comparison drop the benchmark', () => {
  assert.equal(
    describeThesis(sentence({ does: 'rise', benchmark: 'small-caps' })),
    'Among my whole watchlist, recent winners will go up over two weeks'
  )
  assert.equal(
    describeThesis(sentence({ does: 'fall-less', benchmark: 'cash' })),
    'Among my whole watchlist, recent winners will fall less than cash over two weeks'
  )
})

test('the gain and loss version names both targets', () => {
  assert.equal(
    describeThesis(sentence({ does: 'barrier', gains: [5], losses: [3], horizons: [20] })),
    'Among my whole watchlist, recent winners will reach a gain of +5% before a loss of −3% over a month'
  )
})

test('several values are listed in plain words', () => {
  assert.equal(horizonsText([5, 10, 20]), '5, 10 and 20 days')
  assert.equal(horizonsText([7, 30]), '7 and 30 days')
  assert.equal(
    describeThesis(sentence({ does: 'barrier', gains: [3, 5], losses: [2], horizons: [5] })),
    'Among my whole watchlist, recent winners will reach a gain of +3% and +5% before a loss of −2% over a week'
  )
})

test('well-known horizons get a name, others a number of days', () => {
  assert.equal(horizonText(5), 'a week')
  assert.equal(horizonText(10), 'two weeks')
  assert.equal(horizonText(20), 'a month')
  assert.equal(horizonText(1), '1 day')
  assert.equal(horizonText(15), '15 days')
})

test('the number of tests is the product of the values being compared', () => {
  assert.equal(countVariants(DEFAULT_SENTENCE), 1)
  assert.equal(countVariants(sentence({ horizons: [5, 10, 20] })), 3)
  assert.equal(countVariants(sentence({ does: 'barrier', horizons: [5, 10], gains: [3, 5, 10], losses: [2, 3] })), 12)
})

test('gain and loss values do not multiply tests for verbs that do not use them', () => {
  assert.equal(countVariants(sentence({ does: 'outperform', horizons: [5, 10], gains: [3, 5, 10], losses: [2, 3] })), 2)
  assert.equal(isComparingSeveral(sentence({ horizons: [5, 10] })), true)
  assert.equal(isComparingSeveral(DEFAULT_SENTENCE), false)
})

test('only the comparing verbs need a benchmark', () => {
  assert.equal(doesNeedsBenchmark('outperform'), true)
  assert.equal(doesNeedsBenchmark('fall-less'), true)
  assert.equal(doesNeedsBenchmark('rise'), false)
  assert.equal(doesNeedsBenchmark('barrier'), false)
})

test('every option has a unique key, text and hint', () => {
  for (const options of [WHO_OPTIONS, UNIVERSE_OPTIONS, DOES_OPTIONS, BENCHMARK_OPTIONS, CONDITION_OPTIONS]) {
    const keys = options.map((o) => o.key)
    assert.equal(new Set(keys).size, keys.length)
    for (const option of options) {
      assert.ok(option.text.length > 0 && option.hint.length > 0)
    }
  }
})

test('every offered combination of who, universe and verb reads back without error', () => {
  for (const who of WHO_OPTIONS) {
    for (const universe of UNIVERSE_OPTIONS) {
      for (const does of DOES_OPTIONS) {
        const text = describeThesis(sentence({ who: who.key, universe: universe.key, does: does.key }))
        assert.ok(text.startsWith('Among '))
        assert.ok(text.includes(who.text))
      }
    }
  }
})

test('looking up an unknown option fails loudly', () => {
  assert.throws(() => optionText(WHO_OPTIONS, 'nonsense' as never))
})
