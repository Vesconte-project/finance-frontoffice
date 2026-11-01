import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  normalizeOhlcPayload,
  OhlcPayloadError,
  STOCK_OHLC_CACHE_KEY,
} from '../lib/ohlc-data'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const fixtureRows = [
  { price_basis: 'adjusted' as const, date: '2026-07-08', open: 210.12, high: 214.3, low: 209.5, close: 213.91, volume: 52100000 },
  { price_basis: 'adjusted' as const, date: '2026-07-09', open: 214, high: 216.2, low: 212.7, close: 215.43821, volume: 49800000 },
]

test('priced ticker OHLC rows load as a typed loaded result', () => {
  for (const ticker of ['AAPL', 'AMD', 'MSFT']) {
    const result = normalizeOhlcPayload(fixtureRows, { coverageExpectsPrices: true })

    assert.equal(result.status, 'loaded', ticker)
    assert.equal(result.rows.length, 2, ticker)
    assert.equal(result.rows[1]?.close, 215.4382, ticker)
    assert.equal(result.cacheKey, STOCK_OHLC_CACHE_KEY, ticker)
  }
})

test('coverage with prices plus empty OHLC is a dataset error', () => {
  assert.throws(
    () => normalizeOhlcPayload([], { coverageExpectsPrices: true }),
    (error) => {
      assert.ok(error instanceof OhlcPayloadError)
      assert.equal(error.result.status, 'inconsistent_coverage')
      assert.equal(error.result.reason, 'ohlc_empty_but_coverage_has_prices')
      assert.equal(error.result.rows.length, 0)
      return true
    }
  )
})

test('malformed OHLC payload is not normalized into cacheable empty rows', () => {
  assert.throws(
    () => normalizeOhlcPayload({ rows: fixtureRows }, { coverageExpectsPrices: false }),
    (error) => {
      assert.ok(error instanceof OhlcPayloadError)
      assert.equal(error.result.status, 'malformed')
      assert.equal(error.result.reason, 'ohlc_payload_not_array')
      return true
    }
  )

  assert.throws(
    () => normalizeOhlcPayload([{ price_basis: 'adjusted' as const, date: '2026-07-09', close: null }], { coverageExpectsPrices: false }),
    (error) => {
      assert.ok(error instanceof OhlcPayloadError)
      assert.equal(error.result.status, 'malformed')
      assert.equal(error.result.reason, 'adjusted_price_input_invalid')
      return true
    }
  )
})

test('coverage without prices can represent true empty OHLC data', () => {
  const result = normalizeOhlcPayload([], { coverageExpectsPrices: false })

  assert.equal(result.status, 'empty')
  assert.equal(result.reason, 'ohlc_empty_without_price_coverage')
  assert.deepEqual(result.rows, [])
})

test('stock OHLC uses request-local memoization rather than a shared viewer cache', () => {
  const source = readRepoFile('lib/finance.ts')

  assert.equal(STOCK_OHLC_CACHE_KEY, 'stock-ohlc-cache-adjusted-fx-v4')
  assert.match(source, /cache } from .react./)
  assert.doesNotMatch(source, /unstable_cache/)
  assert.doesNotMatch(source, /stock-ohlc-cache-v1/)
})
