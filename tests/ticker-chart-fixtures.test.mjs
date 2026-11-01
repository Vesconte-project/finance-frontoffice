import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeOhlcPayload } from '../.test-build/lib/ohlc-data.js'
import { normalizeAdjustedHistory, readyAdjustedOverlays } from '../.test-build/lib/price-basis.js'
import { tickerHistoryFixture, tickerOhlcFixture, tickerSummaryFixture, tickerTechnicalSeriesFixture } from '../e2e/fixtures/ticker-page.mjs'

for (const ticker of ['QAS', 'QAM', 'QAL']) {
  test(`${ticker} browser fixture satisfies the strict adjusted chart contract`, () => {
    const bars = tickerOhlcFixture(ticker, 3650)
    const result = normalizeOhlcPayload(bars, { coverageExpectsPrices: true })
    assert.equal(result.status, 'loaded')
    assert.equal(result.rows.length, bars.length)
    assert.ok(normalizeAdjustedHistory(tickerHistoryFixture(ticker, 3650)).length > 2500)
    assert.equal(tickerSummaryFixture(ticker).quote.price_basis, 'raw')
    assert.deepEqual(readyAdjustedOverlays(tickerTechnicalSeriesFixture(ticker), bars), [])
    assert.equal(readyAdjustedOverlays(tickerTechnicalSeriesFixture(ticker, { ready: true }), bars).length, 5)
  })
}

test('raw or unlabelled fixture bars are still refused by the production parser', () => {
  const bars = tickerOhlcFixture('QAS', 30)
  assert.throws(() => normalizeOhlcPayload(bars.map(bar => ({ ...bar, price_basis: 'raw' })), { coverageExpectsPrices: true }))
  assert.throws(() => normalizeOhlcPayload(bars.map(bar => { const row = { ...bar }; delete row.price_basis; return row }), { coverageExpectsPrices: true }))
})
