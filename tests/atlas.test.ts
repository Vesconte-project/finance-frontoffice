import assert from 'node:assert/strict'
import test from 'node:test'
import {
  atlasDenial,
  atlasOverviewPath,
  atlasSymbol,
  atlasZoneId,
  contourAnchor,
  parseCompanyPanel,
  parseOverview,
  parseZonePanel,
  sizeSteps,
} from '../lib/atlas-model'
import {
  atlasBounds,
  fitCamera,
  levelForZoom,
  nodeAt,
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

test('the signed-in atlas carries rings, lines and ties, and sizes companies by importance', () => {
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
  assert.deepEqual(atlas.lines, [{ source: 'NVDA', target: 'AMD', zoneId: 'z1' }])
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
  assert.deepEqual(inside.neighbours, [{ symbol: 'NVDA', name: 'NVIDIA', zoneId: 'z1', correlation: 0.61 }])
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

test('zone colours depend on the zone id only, so they hold from week to week', () => {
  const first = zoneHues([{ zoneId: 'b' }, { zoneId: 'a' }] as never)
  const second = zoneHues([{ zoneId: 'a' }, { zoneId: 'b' }] as never)
  assert.deepEqual([...first.entries()].sort(), [...second.entries()].sort())
  assert.notEqual(first.get('a'), first.get('b'))
})
