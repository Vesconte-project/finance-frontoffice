import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveFallbackAtlas,
  marketAtlasCommunityPath,
  marketAtlasNeighborhoodPath,
  marketAtlasPath,
  marketNetworkPath,
  normalizeNetworkGraph,
  normalizeRelationshipAtlas,
  normalizeRelationshipAtlasDetail,
} from '../lib/network'

test('forwards global-map source controls to the backend endpoint', () => {
  assert.equal(
    marketNetworkPath({ window: '252', minAbsCorrelation: 0, topK: 50 }),
    '/network?window=252&minAbsCorrelation=0&topK=50'
  )
})

test('normalizes the relationship-map payload with entity graph ids and representative listings', () => {
  const graph = normalizeNetworkGraph(
    {
      asOf: '2026-07-17',
      window: '252',
      nodes: [
        {
          ticker: 'SAP.DE',
          symbol: 'SAP.DE',
          name: 'SAP listing',
          entity_id: 'entity_sap',
          legal_name: 'SAP SE',
          home_country: 'DE',
          sibling_symbols: ['SAP', 'SAP.DE'],
          degree: 1,
        },
        { ticker: 'SPY', name: 'SPDR S&P 500 ETF', degree: 1 },
      ],
      edges: [
        {
          source: 'entity_sap',
          target: 'SPY',
          layer: 'residual_price',
          strength: 0.82,
          confidence: 0.71,
          direction: 'undirected',
        },
      ],
    },
    null
  )

  assert.equal(graph.nodes.length, 2)
  assert.deepEqual(graph.nodes[0], {
    ticker: 'SAP.DE',
    symbol: 'SAP.DE',
    name: 'SAP SE',
    country: 'DE',
    region: null,
    sector: null,
    marketCap: null,
    marketCapSource: null,
    degree: 1,
    entityId: 'ENTITY_SAP',
    lei: null,
    legalName: 'SAP SE',
    homeCountry: 'DE',
    siblingSymbols: ['SAP', 'SAP.DE'],
  })
  assert.deepEqual(graph.edges, [
    {
      source: 'SAP.DE',
      target: 'SPY',
      correlation: 0.82,
      absCorrelation: 0.82,
      inMst: false,
      relationshipSourceLayer: 'residual_price',
      relationshipConfidence: 0.71,
      relationshipAlpha: 0.71,
      relationshipLabel: 'Residual price',
      relationshipDescription: 'Idiosyncratic relationship after market and FX factors.',
      relationshipColor: 'var(--text-muted)',
      relationshipDash: null,
      relationshipDirectional: false,
    },
  ])
})

test('preserves latest-metadata provenance for network node sizing/display', () => {
  const graph = normalizeNetworkGraph(
    {
      asOf: '2026-07-17',
      window: '252',
      nodes: [{ ticker: 'AAPL', marketCap: 3_000_000_000_000, marketCapSource: 'latest_metadata', degree: 0 }],
      edges: [],
    },
    null
  )

  assert.equal(graph.nodes[0]?.marketCap, 3_000_000_000_000)
  assert.equal(graph.nodes[0]?.marketCapSource, 'latest_metadata')
})

test('builds progressive atlas paths without exposing backend credentials to the browser', () => {
  assert.equal(marketAtlasPath(126, 'timing'), '/network/atlas?window=126&view=timing')
  assert.equal(
    marketAtlasCommunityPath('timing-abc', { window: 126, view: 'timing', limit: 40, asOf: '2026-07-31' }),
    '/network/communities/timing-abc?window=126&view=timing&limit=40&asOf=2026-07-31'
  )
  assert.equal(
    marketAtlasNeighborhoodPath('aapl', { view: 'residual', asOf: '2026-07-31' }),
    '/network/neighborhoods/AAPL?window=252&view=residual&limit=28&asOf=2026-07-31'
  )
})

test('normalizes community positions and confidence for the three-dimensional atlas', () => {
  const atlas = normalizeRelationshipAtlas({
    asOf: '2026-07-31',
    window: 252,
    view: 'theme',
    communities: [{
      id: 'theme-cloud',
      label: 'Cloud infrastructure',
      displayLabel: 'Cloud infrastructure · MSFT',
      displayName: 'Cloud infrastructure-led network',
      description: 'Global relationship field anchored by MSFT.',
      scopeLabel: 'Global',
      memberCount: 12,
      averageConfidence: 1.4,
      dominantSector: 'Technology',
      dominantCountry: null,
      dominantRegion: null,
      marketCapTotal: null,
      bridgeCount: 0,
      position: { x: 1, y: -2, z: 3 },
      representativeSymbols: ['msft'],
      themes: ['Cloud infrastructure'],
    }],
    links: [],
  })

  assert.equal(atlas.communities[0]?.averageConfidence, 1)
  assert.deepEqual(atlas.communities[0]?.position, { x: 1, y: -2, z: 3 })
  assert.deepEqual(atlas.communities[0]?.representativeSymbols, ['MSFT'])
})

test('removes textual missing-value sentinels from atlas metadata', () => {
  const atlas = normalizeRelationshipAtlas({
    communities: [{
      id: 'market-unknown',
      label: 'NaN',
      displayLabel: 'NaN',
      displayName: 'null',
      description: '<NA>',
      scopeLabel: 'unknown',
      memberCount: 4,
      averageConfidence: 0.8,
      dominantSector: 'UNKNOWN',
      dominantCountry: '<NA>',
      dominantRegion: 'null',
      marketCapTotal: null,
      bridgeCount: 0,
      position: { x: 0, y: 0, z: 0 },
      representativeSymbols: [],
      themes: [],
    }],
    landmarks: [{
      symbol: 'abc',
      name: 'none',
      communityId: 'market-unknown',
      position: { x: 0, y: 0, z: 0 },
      importance: 0.4,
      centrality: 0.4,
      bridgeScore: 0,
      volatility: null,
      sector: 'NaN',
      industry: 'UNKNOWN',
      country: null,
      region: null,
      marketCap: null,
      context: false,
      memberships: [],
      isPrimary: true,
    }],
  })

  assert.equal(atlas.communities[0]?.label, 'Market cluster')
  assert.equal(atlas.communities[0]?.displayLabel, 'Cross-market')
  assert.equal(atlas.communities[0]?.displayName, 'Cross-market network')
  assert.equal(atlas.communities[0]?.description, 'Global relationship field.')
  assert.equal(atlas.communities[0]?.dominantSector, null)
  assert.equal(atlas.communities[0]?.dominantCountry, null)
  assert.equal(atlas.landmarks[0]?.name, 'ABC')
  assert.equal(atlas.landmarks[0]?.sector, null)
})

test('normalizes enriched company landmarks without overloading importance', () => {
  const detail = normalizeRelationshipAtlasDetail({
    asOf: '2026-07-31',
    window: 252,
    view: 'market',
    focus: 'AAPL',
    nodes: [{
      symbol: 'aapl',
      name: 'Apple Inc.',
      communityId: 'market-1',
      position: { x: 1, y: 2, z: 3 },
      importance: 0.4,
      centrality: 0.8,
      bridgeScore: 0.7,
      volatility: 0.21,
      sector: 'Technology',
      industry: 'Consumer Electronics',
      country: 'US',
      region: 'northAmerica',
      marketCap: 3_000_000_000_000,
      context: true,
      memberships: [],
      isPrimary: true,
    }],
    edges: [],
  })

  assert.equal(detail.nodes[0]?.symbol, 'AAPL')
  assert.equal(detail.nodes[0]?.centrality, 0.8)
  assert.equal(detail.nodes[0]?.bridgeScore, 0.7)
  assert.equal(detail.nodes[0]?.context, true)
})

test('legacy fail-open preserves real companies and edges instead of inventing category communities', () => {
  const graph = normalizeNetworkGraph({
    asOf: '2026-07-31',
    window: '252',
    nodes: [
      { ticker: 'AAPL', name: 'Apple', sector: 'Technology' },
      { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology' },
      { ticker: 'JPM', name: 'JPMorgan', sector: 'Financials' },
    ],
    edges: [
      { source: 'AAPL', target: 'MSFT', strength: 0.8 },
      { source: 'AAPL', target: 'JPM', strength: 0.4 },
    ],
  }, null)

  const fallback = deriveFallbackAtlas(graph, 'market')
  assert.equal(fallback.atlas.materialized, false)
  assert.equal(fallback.atlas.communities.length, 0)
  assert.deepEqual(fallback.atlas.landmarks.map((node) => node.symbol), ['AAPL', 'MSFT', 'JPM'])
  assert.equal(fallback.atlas.backbone.length, 2)
  assert.equal(fallback.atlas.backbone[0]?.confidence, null)
  assert.deepEqual(fallback.details, {})
})

test('atlas nodes carry their field memberships', () => {
  const atlas = normalizeRelationshipAtlas({
    view: 'theme',
    landmarks: [
      {
        symbol: 'lrcx',
        communityId: 'c1',
        memberships: [
          { communityId: 'c2', weight: 0.08 },
          { communityId: 'c1', weight: 0.87 },
          { communityId: '', weight: 0.5 },
          { communityId: 'c3', weight: 0 },
        ],
      } as never,
    ],
  })

  // Sorted by weight, and entries with no field or no weight dropped.
  assert.deepEqual(atlas.landmarks[0].memberships, [
    { communityId: 'c1', weight: 0.87 },
    { communityId: 'c2', weight: 0.08 },
  ])
})

test('a payload without memberships or detail degrades quietly', () => {
  // Snapshots built before tiering exist, and must not become an error here.
  const atlas = normalizeRelationshipAtlas({ view: 'market', landmarks: [{ symbol: 'AAPL' } as never] })

  assert.equal(atlas.detail, null)
  assert.deepEqual(atlas.landmarks[0].memberships, [])
})

test('the served budget says whether the backbone was clipped', () => {
  const atlas = normalizeRelationshipAtlas({
    view: 'market',
    detail: { backboneTier: 0, nodeBudget: 1000, backboneTruncated: false },
  } as never)

  assert.deepEqual(atlas.detail, { backboneTier: 0, nodeBudget: 1000, backboneTruncated: false })
})
