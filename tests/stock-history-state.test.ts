import assert from 'node:assert/strict'
import test from 'node:test'
import { canExpandHistory, conversionNotice, fullHistoryState, longRangeNotice, technicalBaseNotice } from '../lib/stock-history-state'

test('a pending, failed or empty complete history is never loaded (ENG-272 review)', () => {
  assert.equal(fullHistoryState(null, false), 'loading')
  assert.equal(fullHistoryState(null, true), 'error') // rejected promise
  assert.equal(fullHistoryState({ status: 'unavailable', rows: [] }, false), 'error')
  assert.equal(fullHistoryState({ status: 'malformed', rows: [] }, false), 'error')
  assert.equal(fullHistoryState({ status: 'empty', rows: [] }, false), 'incomplete')
  assert.equal(fullHistoryState({ status: 'loaded', rows: [] }, false), 'error')
  assert.equal(fullHistoryState({ status: 'loaded', rows: [1, 2] }, false), 'loaded')
})

test('long ranges say the chart shows the last year until the history is loaded', () => {
  for (const range of ['5Y', '10Y', 'ALL']) {
    assert.match(longRangeNotice('loading', range) ?? '', /Loading the full price history/)
    assert.match(longRangeNotice('error', range) ?? '', /unavailable/)
    assert.match(longRangeNotice('incomplete', range) ?? '', /last year only/)
    assert.equal(longRangeNotice('loaded', range), null)
  }
  for (const range of ['1D', '1M', '1Y', 'YTD']) assert.equal(longRangeNotice('loading', range), null)
})

test('ALL and the expanded chart open only over the loaded complete history', () => {
  assert.equal(canExpandHistory('loading', 250), false)
  assert.equal(canExpandHistory('error', 250), false)
  assert.equal(canExpandHistory('incomplete', 250), false)
  assert.equal(canExpandHistory('loaded', 1), false)
  assert.equal(canExpandHistory('loaded', 1500), true)
})

test('weekly and monthly technicals say when they read only the last year', () => {
  assert.equal(technicalBaseNotice('loading', '1D'), null)
  assert.match(technicalBaseNotice('loading', '1W') ?? '', /until the full price history loads/)
  assert.match(technicalBaseNotice('error', '1M') ?? '', /unavailable/)
  assert.equal(technicalBaseNotice('loaded', '1M'), null)
})

test('the display currency is loading, failed or loaded, never silently reported', () => {
  assert.equal(conversionNotice('none', null, 'USD'), null)
  assert.equal(conversionNotice('loaded', 'EUR', 'USD'), null)
  assert.match(conversionNotice('loading', 'EUR', 'USD') ?? '', /Converting the chart to EUR\. It shows USD/)
  assert.match(conversionNotice('error', 'EUR', 'USD') ?? '', /could not be loaded\. The chart stays in USD/)
})
