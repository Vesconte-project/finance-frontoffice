import assert from 'node:assert/strict'
import test from 'node:test'
import { assetMetadata } from '../lib/asset-metadata'
import { resolveStockAsset } from '../lib/stock-asset-kind'
import { absenceCopy } from '../lib/ticker-readings'

// Spec "Instrument type as the single source V1", accepted Snapshot
// snap-sha256-2d9f077abb6eae26dcac2415d153fe0a7f04c4755c428d8b6795cd7e3952a30a, §4.4.

function resolve(assetType: string | null | undefined, ticker: string, name: string) {
  return resolveStockAsset({ assetType, ticker, name, latestFundamentals: [] })
}

test('the registry type decides the badge', () => {
  assert.deepEqual(resolve('etf', 'TLT', 'iShares 20+ Year Treasury Bond ETF'), { kind: 'fund', badge: 'ETF', source: 'registry' })
  assert.deepEqual(resolve('index_proxy', 'SPY', 'SPDR S&P 500 ETF Trust'), { kind: 'fund', badge: 'ETF', source: 'registry' })
  assert.deepEqual(resolve('country_fund', 'EWJ', 'iShares MSCI Japan ETF'), {
    kind: 'fund',
    badge: 'Country fund',
    source: 'registry',
  })
  assert.deepEqual(resolve('adr', 'TSM', 'Taiwan Semiconductor'), { kind: 'equity', badge: 'Equity', source: 'registry' })
})

test('a company with "Trust" in its name is a stock when the registry says so', () => {
  // The name guess alone would call it a fund.
  assert.equal(resolve(null, 'NTRS', 'Northern Trust Corporation').badge, 'ETF')
  assert.deepEqual(resolve('equity', 'NTRS', 'Northern Trust Corporation'), { kind: 'equity', badge: 'Equity', source: 'registry' })
})

test('the old guess is used only when the registry type is unknown or absent', () => {
  assert.equal(resolve('unknown', 'QQQ', 'Invesco QQQ Trust').source, 'guess')
  assert.equal(resolve('unknown', 'QQQ', 'Invesco QQQ Trust').kind, 'fund')
  assert.equal(resolve(undefined, 'AAPL', 'Apple Inc.').source, 'guess')
  assert.equal(resolve(undefined, 'AAPL', 'Apple Inc.').kind, 'equity')
  assert.equal(resolve(' ETF ', 'TLT', 'x').source, 'registry')
})

test('the metadata line names the instrument', () => {
  assert.match(assetMetadata('Country fund', null, 'usd'), /^Country fund · USD$/)
  assert.match(assetMetadata('Equity', null, 'usd'), /^Stock · USD$/)
  assert.match(assetMetadata('ETF', null, 'usd'), /^ETF · USD$/)
})

test('a fund reading says it is a fund', () => {
  assert.equal(absenceCopy('is_fund'), 'Fund · not scored as a company')
})
