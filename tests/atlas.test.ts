import assert from 'node:assert/strict'
import test from 'node:test'
import {
  atlasDenial,
  atlasOverviewPath,
  atlasSymbol,
  atlasZoneId,
  capBulk,
  capStep,
  contourAnchor,
  parseCompanyPanel,
  parseMarketCorrelation,
  parseOverview,
  parseZonePanel,
  sizeSteps,
} from '../lib/atlas-model'
import {
  RELIEF_PITCH,
  atlasBounds,
  ballRadius,
  buildSheet,
  bundleStrands,
  correlationSentence,
  findOnMap,
  fitCamera,
  focusBundles,
  groundAt,
  levelForZoom,
  mapExtent,
  mostConnected,
  nodeAt,
  panBy,
  ringShares,
  toScreen,
  toWorld,
  zoneAt,
  zoneHues,
  zoomAt,
} from '../lib/atlas-view'

const signedOutAccess = { tier: 'signedOut', maxLevel: 1, historyWeeks: 0, lines: false, bundleTies: false, truePositions: false, movement: false }
const freeAccess = { tier: 'free', maxLevel: 3, historyWeeks: 0, lines: true, bundleTies: true, truePositions: true, movement: false }

// The signed-out shape the backend sends (rule 7): circle contours, schematic positions, size steps, tie counts.
const signedOut = {
  asOf: '2026-10-16',
  companyCount: 650,
  zoneCount: 2,
  access: signedOutAccess,
  level: 1,
  zones: [
    { zoneId: 'residual-a', label: 'Semiconductors', labelSource: 'industry', memberCount: 40, x: 1, y: 2, contour: { type: 'circle', x: 1, y: 2, radius: 1.5 } },
    { zoneId: 'residual-b', label: 'Oil & Gas', labelSource: 'industry', memberCount: 30, x: -4, y: -1, contour: { type: 'circle', x: -4, y: -1, radius: 1 } },
  ],
  nodes: [
    { symbol: 'AMD', name: 'Advanced Micro Devices', zoneId: 'residual-a', x: 1.2, y: 2.1, level: 0, size: 0 },
    { symbol: 'COP', name: 'ConocoPhillips', zoneId: 'residual-b', x: -4.1, y: -0.8, level: 1, size: 2 },
    { symbol: 'GHOST', name: null, zoneId: 'nowhere', x: 0, y: 0, level: 0, size: 1 },
  ],
  bundles: [
    { zoneA: 'residual-a', zoneB: 'residual-b', tieCount: 12 },
    { zoneA: 'residual-a', zoneB: 'missing', tieCount: 3 },
  ],
}

test('the signed-out atlas reads as sent and drops entries that point nowhere', () => {
  const atlas = parseOverview(signedOut)
  assert.ok(atlas)
  assert.equal(atlas.access.tier, 'signedOut')
  assert.equal(atlas.access.lines, false)
  assert.deepEqual(atlas.nodes.map((node) => [node.symbol, node.level, node.size]), [['AMD', 0, 0], ['COP', 1, 2]])
  assert.deepEqual(atlas.bundles, [{ zoneA: 'residual-a', zoneB: 'residual-b', tieCount: 12, structural: false, ties: [] }])
  assert.deepEqual(atlas.lines, [])
  assert.deepEqual(atlas.zones[0].contour, { type: 'circle', x: 1, y: 2, radius: 1.5 })
})

test('the signed-in atlas carries rings, lines and ties, and sizes companies without a value by importance', () => {
  const atlas = parseOverview({
    asOf: '2026-10-16',
    companyCount: 3,
    zoneCount: 1,
    access: freeAccess,
    level: 1,
    zones: [{
      zoneId: 'z1', label: 'Semis', memberCount: 3, leaders: ['NVDA'],
      contour: { type: 'rings', coverage: 0.8, rings: [[[0, 0], [4, 0], [4, 4], [0, 4]], [[10, 10], [11, 10], [11, 11]], [[1, 1], ['x', 2]]] },
    }],
    nodes: [
      { symbol: 'NVDA', zoneId: 'z1', x: 1, y: 1, level: 0, importance: 0.9 },
      { symbol: 'AMD', zoneId: 'z1', x: 2, y: 2, level: 0, importance: 0.5 },
      { symbol: 'MU', zoneId: 'z1', x: 3, y: 1, level: 1, importance: 0.1 },
      { symbol: 'BAD', zoneId: 'z1', x: Number.NaN, y: 1, level: 1, importance: 0.2 },
    ],
    skeleton: [
      { source: 'NVDA', target: 'AMD', zoneId: 'z1', correlation: 0.61 },
      { source: 'NVDA', target: 'GONE', zoneId: 'z1', correlation: 0.5 },
    ],
    bundles: [],
  })
  assert.ok(atlas)
  assert.deepEqual(atlas.nodes.map((node) => [node.symbol, node.size]), [['NVDA', 0], ['AMD', 1], ['MU', 2]])
  assert.deepEqual(atlas.lines, [{ source: 'NVDA', target: 'AMD', zoneId: 'z1', correlation: 0.61 }])
  const contour = atlas.zones[0].contour
  assert.ok(contour && contour.type === 'rings')
  assert.equal(contour.rings.length, 2, 'a ring with a broken point is dropped, not repaired')
  // the label sits in the middle of the largest ring
  assert.deepEqual([atlas.zones[0].x, atlas.zones[0].y], [2, 2])
  assert.deepEqual(contourAnchor(contour), [2, 2])
})

test('a payload that is not an atlas reads as null', () => {
  assert.equal(parseOverview(null), null)
  assert.equal(parseOverview({ asOf: '2026-10-16', access: { tier: 'admin' } }), null)
  assert.equal(parseOverview({ access: signedOutAccess }), null)
  assert.equal(parseCompanyPanel({ access: freeAccess, asOf: '2026-10-16', symbol: 'AMD' }), null)
  assert.equal(parseZonePanel([]), null)
})

test('refusals keep their reason, and nothing else counts as one', () => {
  assert.equal(atlasDenial({ detail: 'sign_in_required' }), 'sign_in_required')
  assert.equal(atlasDenial({ detail: 'pro_required' }), 'pro_required')
  assert.equal(atlasDenial({ detail: 'history_unavailable' }), 'history_unavailable')
  assert.equal(atlasDenial({ detail: 'Forbidden' }), null)
  assert.equal(atlasDenial('sign_in_required'), null)
})

test('panels read the signed-out and signed-in shapes', () => {
  const outside = parseCompanyPanel({
    asOf: '2026-10-16', access: signedOutAccess, symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology',
    industry: 'Semiconductors', country: 'US', zoneId: 'residual-a', zoneLabel: 'Semiconductors',
    zoneLeaders: [{ symbol: 'NVDA', name: 'NVIDIA' }, { symbol: 'AMD', name: 'Advanced Micro Devices' }],
  })
  assert.ok(outside)
  assert.deepEqual(outside.neighbours, [])
  assert.deepEqual(outside.zoneLeaders.map((leader) => leader.symbol), ['NVDA', 'AMD'])

  const inside = parseCompanyPanel({
    asOf: '2026-10-16', access: freeAccess, symbol: 'AMD', zoneId: 'z1', zoneLabel: 'Semis', marketCap: 3e11,
    memberships: [{ zoneId: 'z1', label: 'Semis', share: 0.8 }, { zoneId: 'z2', label: 'AI', share: 0.2 }],
    neighbours: [{ symbol: 'NVDA', name: 'NVIDIA', zoneId: 'z1', correlation: 0.61 }, { symbol: 'X', correlation: 'high' }],
  })
  assert.ok(inside)
  assert.deepEqual(inside.neighbours, [{ symbol: 'NVDA', name: 'NVIDIA', zoneId: 'z1', correlation: 0.61, total: null, trend: null }])
  assert.equal(inside.memberships.length, 2)

  const zone = parseZonePanel({ asOf: '2026-10-16', access: signedOutAccess, zoneId: 'residual-a', label: 'Semis', memberCount: 40, leaders: [{ symbol: 'NVDA', name: null }] })
  assert.ok(zone)
  assert.deepEqual(zone.members, [])
})

test('the overview path asks for one level and an area only when given one', () => {
  assert.equal(atlasOverviewPath(1), '/api/atlas?level=1')
  assert.equal(atlasOverviewPath(9), '/api/atlas?level=3')
  assert.equal(atlasOverviewPath(2, [-1, -2.5, 3, 4]), '/api/atlas?level=2&bbox=-1.000%2C-2.500%2C3.000%2C4.000')
})

test('tickers and zone ids are checked before they reach the backend', () => {
  assert.equal(atlasSymbol(' brk.b '), 'BRK.B')
  assert.equal(atlasSymbol('WBC.AX'), 'WBC.AX')
  assert.equal(atlasSymbol('../admin'), null)
  assert.equal(atlasSymbol(''), null)
  assert.equal(atlasZoneId('residual-08279f8ef4'), 'residual-08279f8ef4')
  assert.equal(atlasZoneId('a/b'), null)
})

test('size steps split the ranking in four, largest first', () => {
  const steps = sizeSteps(new Map([['A', 9], ['B', 7], ['C', 5], ['D', 3], ['E', 1], ['F', 0.5], ['G', 0.2], ['H', 0.1]]))
  assert.deepEqual([...steps.entries()], [['A', 0], ['B', 0], ['C', 1], ['D', 1], ['E', 2], ['F', 2], ['G', 3], ['H', 3]])
})

test('the camera fits the map, and zooming keeps the point under the pointer still', () => {
  const atlas = parseOverview(signedOut)
  assert.ok(atlas)
  const viewport = { width: 800, height: 500 }
  const bounds = atlasBounds(atlas)
  const fit = fitCamera(bounds, viewport)
  const [left] = toScreen(fit, viewport, bounds.x0, 0)
  const [right] = toScreen(fit, viewport, bounds.x1, 0)
  assert.ok(left >= -0.001 && right <= 800.001)
  const zoomed = zoomAt(fit, viewport, fit.k, 2, 300, 200)
  const before = toWorld(fit, viewport, 300, 200)
  const after = toWorld(zoomed, viewport, 300, 200)
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9 && Math.abs(before[1] - after[1]) < 1e-9)
  assert.equal(zoomed.k, fit.k * 2)
  // north is up
  assert.ok(toScreen(fit, viewport, 0, 1)[1] < toScreen(fit, viewport, 0, 0)[1])
  // the zoom range is bounded
  assert.equal(zoomAt(fit, viewport, fit.k, 1000, 0, 0).k, fit.k * 24)
})

test('the zoom sets the level, never beyond what the reader may load', () => {
  assert.equal(levelForZoom(1, 3), 0)
  assert.equal(levelForZoom(1.8, 3), 1)
  assert.equal(levelForZoom(4, 3), 2)
  assert.equal(levelForZoom(9, 3), 3)
  assert.equal(levelForZoom(9, 1), 1)
})

test('hit testing finds the company under the pointer and the zone under a point', () => {
  const atlas = parseOverview(signedOut)
  assert.ok(atlas)
  const viewport = { width: 800, height: 500 }
  const fit = fitCamera(atlasBounds(atlas), viewport)
  const [ax, ay] = toScreen(fit, viewport, 1.2, 2.1)
  assert.equal(nodeAt(atlas.nodes, fit, viewport, ax + 3, ay - 2)?.symbol, 'AMD')
  assert.equal(nodeAt(atlas.nodes, fit, viewport, ax + 60, ay + 60), null)
  assert.equal(zoneAt(atlas.zones, 1, 2.5)?.zoneId, 'residual-a')
  assert.equal(zoneAt(atlas.zones, 10, 10), null)

  const holed = parseOverview({
    asOf: '2026-10-16', access: freeAccess, level: 0, nodes: [], bundles: [],
    zones: [{ zoneId: 'ring', label: 'R', memberCount: 1, contour: { type: 'rings', rings: [[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]] } }],
  })
  assert.ok(holed)
  assert.equal(zoneAt(holed.zones, 2, 2)?.zoneId, 'ring')
  assert.equal(zoneAt(holed.zones, 5, 5), null, 'a hole is outside the zone')
})

test('signed in, size is market value in fixed steps, and reach, wells and loners come through', () => {
  const atlas = parseOverview({
    asOf: '2026-10-16', access: freeAccess, level: 1,
    zones: [{ zoneId: 'z1', label: 'Semis', memberCount: 4, contour: null }],
    nodes: [
      { symbol: 'BIG', zoneId: 'z1', x: 0, y: 0, level: 0, importance: 0.1, marketCap: 3e12, reach: 0.7, well: 1, loner: false,
        memberships: [{ zoneId: 'z2', share: 0.2 }, { zoneId: 'z1', share: 0.8 }, { zoneId: 'z1', share: 0.1 }, { zoneId: 'z3', share: 2 }] },
      { symbol: 'MID', zoneId: 'z1', x: 1, y: 0, level: 0, importance: 0.9, marketCap: 60e9, reach: 0.4, well: 0.5, memberships: [{ zoneId: 'z1', share: 0.9 }, { zoneId: 'z2', share: 0.1 }] },
      { symbol: 'SMALL', zoneId: 'z1', x: 2, y: 0, level: 1, importance: 0.5, marketCap: 2e9, reach: 'x', well: 4, loner: true },
    ],
    bundles: [{ zoneA: 'z1', zoneB: 'z1', tieCount: 2, ties: [{ source: 'BIG', target: 'MID', correlation: 0.52 }, { source: 'A', target: 'B', correlation: 7 }] }],
    marketCorrelation: { value: 0.0712, comparedWithLastYear: 'lower', weeksCompared: 52 },
  })
  assert.ok(atlas)
  // size follows the value itself, so a company keeps its size in every area it loads with
  assert.deepEqual(atlas.nodes.map((node) => [node.symbol, node.size]), [['BIG', 0], ['MID', 1], ['SMALL', 3]])
  assert.deepEqual(atlas.nodes.map((node) => node.reach), [0.7, 0.4, null])
  assert.deepEqual(atlas.nodes.map((node) => node.well), [1, 0.5, 1], 'a well beyond 1 is clamped, never trusted')
  assert.deepEqual(atlas.nodes.map((node) => node.loner), [false, false, true])
  assert.deepEqual(atlas.bundles[0].ties.map((tie) => tie.correlation), [0.52, null], 'a correlation outside -1..1 is dropped')
  assert.deepEqual(atlas.marketCorrelation, { value: 0.0712, comparedWithLastYear: 'lower', weeksCompared: 52 })
  assert.equal(capStep(200e9), 0)
  assert.equal(capStep(9e9), 3)
  // a ball's radius is continuous in market value, as in the prototype; small companies share the floor
  const [big, mid, small] = atlas.nodes
  assert.ok(big.bulk > mid.bulk && mid.bulk > small.bulk)
  assert.ok(Math.abs(capBulk(5e12) - 0.28) < 1e-12, 'above the top every ball is the largest')
  assert.equal(capBulk(50e6), 0.06)
  // regions: a duplicate or a share outside 0..1 is dropped; largest first
  assert.deepEqual(big.memberships, [{ zoneId: 'z1', share: 0.8 }, { zoneId: 'z2', share: 0.2 }])
  assert.deepEqual(ringShares(big).map((item) => item.zoneId), ['z1', 'z2'])
  assert.deepEqual(ringShares(mid), [], 'under 15% outside its region, a ball has no ring')
  assert.deepEqual(small.memberships, [], 'no memberships, no ring')
})

test('the market correlation is read only when it is a real value', () => {
  assert.equal(parseMarketCorrelation(null), null)
  assert.equal(parseMarketCorrelation({ value: 2 }), null)
  assert.deepEqual(parseMarketCorrelation({ value: 0.1, comparedWithLastYear: 'odd' }), { value: 0.1, comparedWithLastYear: null, weeksCompared: 0 })
  assert.equal(parseOverview(signedOut)?.marketCorrelation, null)
  assert.equal(correlationSentence(null), null)
  assert.equal(correlationSentence({ value: 0.0712, comparedWithLastYear: null, weeksCompared: 30 }), 'Average correlation 0.07')
  assert.equal(correlationSentence({ value: 0.0712, comparedWithLastYear: 'lower', weeksCompared: 52 }), 'Average correlation 0.07 · lower for this market over the last year')
  assert.equal(correlationSentence({ value: 0.1, comparedWithLastYear: 'usual', weeksCompared: 52 }), 'Average correlation 0.10 · about usual for this market over the last year')
})

test('a tilted camera keeps the ground under the pointer, fits the map and raises what sits above the ground', () => {
  const viewport = { width: 800, height: 500 }
  const bounds = { x0: -10, y0: -6, x1: 10, y1: 6 }
  const flat = fitCamera(bounds, viewport)
  const tilted = fitCamera(bounds, viewport, RELIEF_PITCH)
  assert.equal(flat.pitch, 0)
  assert.ok(tilted.k >= flat.k, 'a tilted map is shorter on screen, so it can be shown larger')
  const [, top] = toScreen(tilted, viewport, 0, bounds.y1)
  const [, bottom] = toScreen(tilted, viewport, 0, bounds.y0)
  assert.ok(top >= -0.001 && bottom <= 500.001)
  for (const [px, py] of [[100, 50], [400, 250], [700, 480]]) {
    const [x, y] = toWorld(tilted, viewport, px, py)
    const [sx, sy] = toScreen(tilted, viewport, x, y)
    assert.ok(Math.abs(sx - px) < 1e-9 && Math.abs(sy - py) < 1e-9)
  }
  // a well (negative z) shows lower on screen; a flat view shows no height at all
  assert.ok(toScreen(tilted, viewport, 0, 0, -1)[1] > toScreen(tilted, viewport, 0, 0, 0)[1])
  assert.equal(toScreen(flat, viewport, 0, 0, -1)[1], toScreen(flat, viewport, 0, 0, 0)[1])
  // a drag moves the ground with the pointer
  const before = toWorld(tilted, viewport, 300, 200)
  const after = toWorld(panBy(tilted, 40, -25), viewport, 340, 175)
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9 && Math.abs(before[1] - after[1]) < 1e-9)
  const zoomed = zoomAt(tilted, viewport, tilted.k, 2, 300, 200)
  const kept = toWorld(zoomed, viewport, 300, 200)
  assert.ok(Math.abs(before[0] - kept[0]) < 1e-9 && Math.abs(before[1] - kept[1]) < 1e-9)
  assert.equal(zoomed.pitch, RELIEF_PITCH)
})

test('the map fits in the space the controls leave free', () => {
  const viewport = { width: 375, height: 600 }
  const bounds = { x0: -10, y0: -6, x1: 10, y1: 6 }
  const insets = { top: 150, right: 16, bottom: 72, left: 16 }
  const camera = fitCamera(bounds, viewport, RELIEF_PITCH, insets)
  const [left, top] = toScreen(camera, viewport, bounds.x0, bounds.y1)
  const [right, bottom] = toScreen(camera, viewport, bounds.x1, bounds.y0)
  assert.ok(left >= 16 - 1e-6 && right <= 375 - 16 + 1e-6)
  assert.ok(top >= 150 - 1e-6 && bottom <= 600 - 72 + 1e-6)
  // centred in the free area
  assert.ok(Math.abs((left + right) / 2 - (16 + (375 - 32) / 2)) < 1e-6)
  assert.ok(Math.abs((top + bottom) / 2 - (150 + (600 - 222) / 2)) < 1e-6)
})

test('the ground sinks under the deepest wells, and stays flat without any', () => {
  const node = (symbol: string, x: number, y: number, well: number | null) =>
    ({ symbol, name: null, zoneId: 'z', x, y, level: 0, size: 0, bulk: 0.06, reach: null, well, loner: false, memberships: [], fidelity: null, themes: [], marketCap: null })
  const bounds = { x0: -10, y0: -10, x1: 10, y1: 10 }
  assert.equal(buildSheet([node('A', 0, 0, null)], bounds), null)
  assert.equal(groundAt(null, 0, 0), 0)
  const sheet = buildSheet([node('DEEP', -5, 0, 1), node('SHALLOW', 5, 0, 0.4)], bounds)
  assert.ok(sheet)
  const deep = groundAt(sheet, -5, 0)
  const shallow = groundAt(sheet, 5, 0)
  assert.ok(deep < shallow && shallow < 0, 'a well sinks with the square of its depth')
  assert.ok(Math.abs(deep + sheet.depth) < sheet.depth * 0.05, 'the deepest point reaches the full depth')
  assert.equal(groundAt(sheet, 0, 9.5), 0, 'far from every well the ground is flat')
})

test('a bundle runs each real tie between companies on the map, and only those', () => {
  const positions = new Map([
    ['A1', { x: 0, y: 0, zoneId: 'a' }], ['A2', { x: 0, y: 2, zoneId: 'a' }],
    ['B1', { x: 10, y: 0, zoneId: 'b' }], ['B2', { x: 10, y: 2, zoneId: 'b' }],
  ])
  const strands = bundleStrands({
    zoneA: 'a', zoneB: 'b', tieCount: 5, structural: true,
    ties: [
      { source: 'A1', target: 'B1', correlation: 0.5 },
      { source: 'B2', target: 'A2', correlation: 0.4 },
      { source: 'A1', target: 'OFFMAP', correlation: 0.6 },
    ],
  }, positions)
  assert.equal(strands.length, 2, 'a tie with a company not on the map is left out')
  // every strand runs from zone a to zone b, whichever way the tie was written
  assert.deepEqual(strands.map((strand) => [strand.from, strand.to]), [[[0, 0], [10, 0]], [[0, 2], [10, 2]]])
  // the strands gather towards the middle
  for (const strand of strands) assert.ok(Math.abs(strand.c1[1] - 1) < Math.abs(strand.from[1] - 1) + 1e-9)
  const bundles = [
    { zoneA: 'a', zoneB: 'b', tieCount: 3, structural: true, ties: [] },
    { zoneA: 'c', zoneB: 'a', tieCount: 9, structural: false, ties: [] },
    { zoneA: 'b', zoneB: 'c', tieCount: 20, structural: true, ties: [] },
  ]
  assert.deepEqual(focusBundles(bundles, 'a', 3).map((bundle) => bundle.tieCount), [9, 3])
})

test('search finds companies by ticker first, then names and regions', () => {
  const atlas = parseOverview(signedOut)
  assert.ok(atlas)
  assert.deepEqual(findOnMap('amd', atlas.nodes, atlas.zones).map((result) => result.kind === 'company' ? result.symbol : result.label), ['AMD'])
  assert.deepEqual(findOnMap('oil', atlas.nodes, atlas.zones).map((result) => result.kind), ['zone'])
  assert.deepEqual(findOnMap('  ', atlas.nodes, atlas.zones), [])
  const both = findOnMap('co', atlas.nodes, atlas.zones)
  assert.equal(both[0].kind === 'company' && both[0].symbol, 'COP', 'a ticker prefix ranks before a name match')
})

test('"Most connected" ranks by reach, and is empty signed out', () => {
  const atlas = parseOverview(signedOut)
  assert.ok(atlas)
  assert.deepEqual(mostConnected(atlas.nodes), [])
  const node = (symbol: string, reach: number | null) => ({ symbol, name: null, zoneId: 'z', x: 0, y: 0, level: 0, size: 0, bulk: 0.06, reach, well: null, loner: false, memberships: [], fidelity: null, themes: [], marketCap: null })
  assert.deepEqual(mostConnected([node('A', 0.2), node('B', 0.9), node('C', null), node('D', 0.9)], 2).map((item) => item.symbol), ['B', 'D'])
})

test('balls scale with the map on screen and the square root of the zoom, never under 1.4 px', () => {
  // the prototype at 1440 px: its 70-unit side fills 887 px, so the largest ball is 3.5 px
  assert.equal(ballRadius(0.28, 1, 887), 0.28 / 70 * 887)
  assert.equal(ballRadius(0.28, 4, 887), 2 * ballRadius(0.28, 1, 887))
  assert.equal(ballRadius(0.06, 1, 887), 1.4)
  const fit = fitCamera({ x0: 0, y0: 0, x1: 20, y1: 10 }, { width: 400, height: 400 })
  assert.equal(mapExtent({ x0: 0, y0: 0, x1: 20, y1: 10 }, fit), 200)
})

test('zone colours depend on the zone id only, so they hold from week to week', () => {
  const first = zoneHues([{ zoneId: 'b' }, { zoneId: 'a' }] as never)
  const second = zoneHues([{ zoneId: 'a' }, { zoneId: 'b' }] as never)
  assert.deepEqual([...first.entries()].sort(), [...second.entries()].sort())
  assert.notEqual(first.get('a'), first.get('b'))
})
