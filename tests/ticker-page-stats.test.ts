import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalTickerStats } from '../lib/ticker-page-stats'

test('canonical overview stats prefer snapshot profile market cap and use market stats volume', () => {
  const stats = canonicalTickerStats({
    snapshotProfileMarketCap: 2_000_000_000,
    fundamentalsMarketCap: 1_000_000_000,
    quoteMarketCapText: '$1.0B',
    fundamentalsTrailingPe: 18.25,
    profileTrailingPe: 19.5,
    marketStatsVolume: 1_234_567,
  })

  assert.equal(stats.marketCap, 2_000_000_000)
  assert.equal(stats.trailingPe, 18.25)
  assert.equal(stats.volume, 1_234_567)
})

test('canonical overview stats fall back only to declared summary fields', () => {
  const stats = canonicalTickerStats({
    snapshotProfileMarketCap: null,
    fundamentalsMarketCap: 900_000_000,
    quoteMarketCapText: '$0.9B',
    fundamentalsTrailingPe: null,
    profileTrailingPe: null,
    marketStatsVolume: null,
  })

  assert.equal(stats.marketCap, 900_000_000)
  assert.equal(stats.trailingPe, null)
  assert.equal(stats.volume, null)
})

test('canonical overview stats do not treat latest metadata as an as-of market cap', () => {
  const stats = canonicalTickerStats({
    snapshotProfileMarketCap: null,
    fundamentalsMarketCap: null,
    quoteMarketCapText: null,
    fundamentalsTrailingPe: null,
    profileTrailingPe: null,
    marketStatsVolume: null,
    latestMetadataMarketCap: 3_000_000_000_000,
  } as Parameters<typeof canonicalTickerStats>[0])

  assert.equal(stats.marketCap, null)
})

test('every tab reads the same market cap: the snapshot figure, else the quote text', async () => {
  const { tickerMarketCap } = await import('../lib/ticker-page-stats')
  assert.equal(tickerMarketCap({ profile: { marketCap: 2e12 }, quote: { marketCapText: '$4.98T' } }), 2e12)
  assert.equal(tickerMarketCap({ fundamentalsSummary: { marketCap: 3e12 }, quote: { marketCapText: '$4.98T' } }), 3e12)
  assert.equal(tickerMarketCap({ quote: { marketCapText: '$4.98T' } }), 4.98e12)
  assert.equal(tickerMarketCap({ quote: { marketCapText: 'n/a' } }), null)
})
