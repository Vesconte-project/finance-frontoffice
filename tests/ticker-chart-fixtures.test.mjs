import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeOhlcPayload } from '../.test-build/lib/ohlc-data.js'
import { normalizeAdjustedHistory, readyAdjustedOverlays } from '../.test-build/lib/price-basis.js'
import { tickerHistoryFixture, tickerOhlcFixture, tickerSummaryFixture, tickerTechnicalSeriesFixture, tickerPricePageFixture } from '../e2e/fixtures/ticker-page.mjs'
import { collectPricePages } from '../.test-build/lib/full-history.js'

for (const resource of ['history', 'ohlc']) {
  test(`${resource} browser stub serves exactly three adjacent backward weekly pages`, async () => {
    const pages = []
    const rows = await collectPricePages(async end => {
      const page = tickerPricePageFixture('QA30', resource, 0, end || undefined)
      pages.push(page)
      return page
    })
    assert.deepEqual(pages.map(page => page.rows.length), [600, 600, 600])
    assert.equal(pages[2].nextEnd, null)
    assert.equal(rows.length, 1800)
    assert.equal(rows[0].date, pages[2].rows[0].date)
    assert.equal(rows.at(-1).date, tickerHistoryFixture('QA30', 0).at(-1).date)
    for (let i = 1; i < rows.length; i++) {
      const days = (Date.parse(rows[i].date) - Date.parse(rows[i - 1].date)) / 86400000
      assert.equal(days, 7, 'weekly boundaries have no gap or overlap')
    }
  })
}

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
