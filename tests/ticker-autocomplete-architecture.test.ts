import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  filterTickerIndexItems,
  normalizeTickerIndexPayload,
  tickerIndexItemToSearchResult,
} from '../lib/ticker-search'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function walkFiles(relativeDir: string): string[] {
  const dir = path.join(process.cwd(), relativeDir)
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(relativePath))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(relativePath)
    }
  }

  return files
}

test('autocomplete has no network search request for typed queries', () => {
  const source = readRepoFile('components/search/TickerSearchCombobox.tsx')

  assert.match(source, /\/api\/tickers\/index/)
  assert.doesNotMatch(source, /\/api\/search/)
  assert.doesNotMatch(source, /\/api\/tickers\/enrich/)
  assert.doesNotMatch(source, /fetch\([^)]*[?&]q=/s)
  assert.doesNotMatch(source, /scorecard/)
  assert.doesNotMatch(source, /\/api\/tickers\/\$\{/)
  assert.doesNotMatch(source, /displaySource: 'manual'/)
  assert.doesNotMatch(source, /Open this ticker/)
  assert.doesNotMatch(source, /request onboarding/)
  assert.doesNotMatch(source, /ensureTickerOnboarding/)
  assert.doesNotMatch(source, /fetchTickerEnrichments/)
  assert.doesNotMatch(source, /tickerEnrichment/)
  assert.doesNotMatch(source, /AbortController/)
  assert.doesNotMatch(source, /OrbitMini/)
  assert.doesNotMatch(source, /Sparkles/)
})

test('autocomplete runtime path contains no Yahoo or external discovery code', () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), 'app/api/search/route.ts')), false)

  const files = [
    ...walkFiles('app/api/tickers'),
    'components/search/TickerSearchCombobox.tsx',
    'lib/ticker-search.ts',
  ]
  const source = files.map((file) => readRepoFile(file)).join('\n')

  assert.doesNotMatch(source, /\/api\/tickers\/enrich/)
  assert.doesNotMatch(source, /query2\.finance\.yahoo\.com\/v1\/finance\/search/)
  assert.doesNotMatch(source, /enableFuzzyQuery/)
  assert.doesNotMatch(source, /YahooSearch/)
  assert.doesNotMatch(source, /searchYahoo/)
})

test('local index suggestions are available without enrichment', () => {
  const index = normalizeTickerIndexPayload(
    {
      items: [
        { symbol: 'GME', name: 'GameStop Corp.', exchange: 'NYSE', hasSignals: false },
        { symbol: 'ABNB', name: 'Airbnb, Inc.', exchange: 'NASDAQ', hasSignals: false },
        { symbol: 'BCP', name: 'Banco Comercial Portugues, S.A.', exchange: 'EURONEXT', hasSignals: false },
      ],
    },
    null
  )

  assert.ok(index)
  assert.deepEqual(
    filterTickerIndexItems(index.items, 'gamestop', 8).map((item) => ({
      name: item.name,
      scorecard: item.scorecard,
      symbol: item.symbol,
    })),
    [{ name: 'GameStop Corp.', scorecard: null, symbol: 'GME' }]
  )
  assert.deepEqual(
    filterTickerIndexItems(index.items, 'bcp', 8).map((item) => item.symbol),
    ['BCP']
  )
})

test('index rows carry autocomplete status without enrichment', () => {
  const index = normalizeTickerIndexPayload(
    {
      items: [
        {
          symbol: 'IBER',
          name: 'Iberdrola, S.A.',
          exchange: 'BME',
          hasSignals: true,
          coverageState: 'partial',
        },
      ],
    },
    null
  )

  assert.ok(index)
  const result = tickerIndexItemToSearchResult(index.items[0])
  assert.equal(result.symbol, 'IBER')
  assert.equal(result.name, 'Iberdrola, S.A.')
  assert.equal(result.exchange, 'BME')
  assert.equal(result.hasSignals, true)
  assert.equal(result.readiness?.label, 'Partial data')
})

test('recent symbols can be hydrated by joining against the ticker index', () => {
  const index = normalizeTickerIndexPayload(
    {
      items: [
        { symbol: 'ABNB', name: 'Airbnb, Inc.', exchange: 'NASDAQ', hasSignals: true },
        { symbol: 'GME', name: 'GameStop Corp.', exchange: 'NYSE', hasSignals: false },
      ],
    },
    null
  )

  assert.ok(index)
  const bySymbol = new Map(index.items.map((item) => [item.symbol, tickerIndexItemToSearchResult(item)]))
  const recentSymbols = ['ABNB', 'GME', 'MISSING']
  assert.deepEqual(
    recentSymbols.flatMap((symbol) => bySymbol.get(symbol) ?? []),
    [
      {
        symbol: 'ABNB',
        name: 'Airbnb, Inc.',
        exchange: 'NASDAQ',
        hasSignals: true,
        readiness: null,
        convictionPct: null,
        tone: null,
        signalDate: null,
        scorecard: null,
      },
      {
        symbol: 'GME',
        name: 'GameStop Corp.',
        exchange: 'NYSE',
        hasSignals: false,
        readiness: null,
        convictionPct: null,
        tone: null,
        signalDate: null,
        scorecard: null,
      },
    ]
  )
})


test('public ticker onboarding routes and helper are retired', () => {
  for (const retired of ['app/api/tickers/request/route.ts', 'app/api/tickers/status/route.ts', 'lib/ticker-onboarding.ts']) {
    assert.equal(fs.existsSync(path.join(process.cwd(), retired)), false, retired)
  }
  const source = [...walkFiles('app'), ...walkFiles('components'), ...walkFiles('lib')]
    .map(file => readRepoFile(file)).join('\n')
  assert.doesNotMatch(source, /\/api\/tickers\/(request|status)|ensureTickerOnboarding|requestTickerOnboarding/)
})
