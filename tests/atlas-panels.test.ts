import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCompanyPanel, parseOverview, parseZonePanel, type AtlasZone } from '../lib/atlas-model'
import {
  betweenRegions,
  browseRegions,
  cohesionDots,
  coverageOf,
  linkText,
  movesWithOthers,
  nameSourceLine,
  namingNote,
  regionChanges,
  topLinks,
} from '../lib/atlas-panels'

const access = { tier: 'free', maxLevel: 3, historyWeeks: 0, lines: true, bundleTies: true, truePositions: true, movement: false }

function zone(zoneId: string, extra: Partial<AtlasZone> = {}): AtlasZone {
  return { zoneId, label: zoneId, memberCount: 10, x: 0, y: 0, contour: null, contourByValue: null, leaders: [], labelSource: null, labelSupport: null, dominantSector: null, totalMarketCap: null, cohesion: null, fidelity: null, ...extra }
}

test('zones, bundles and panels read the region facts, and drop what is malformed', () => {
  const atlas = parseOverview({
    asOf: '2026-10-16', access, level: 1,
    zones: [
      { zoneId: 'a', label: 'A', memberCount: 4, labelSource: 'industry', labelSupport: 0.67, dominantSector: 'Tech', totalMarketCap: 5e11, cohesion: 0.42, fidelity: 0.8 },
      { zoneId: 'b', label: 'B', memberCount: 4, labelSource: 'planet', labelSupport: 3, totalMarketCap: -1 },
    ],
    nodes: [],
    bundles: [{ zoneA: 'a', zoneB: 'b', tieCount: 9, meanCorrelation: 0.31 }, { zoneA: 'a', zoneB: 'b', tieCount: 2 }],
  })
  assert.ok(atlas)
  assert.deepEqual([atlas.zones[0].labelSource, atlas.zones[0].labelSupport, atlas.zones[0].dominantSector, atlas.zones[0].totalMarketCap, atlas.zones[0].cohesion, atlas.zones[0].fidelity], ['industry', 0.67, 'Tech', 5e11, 0.42, 0.8])
  assert.deepEqual([atlas.zones[1].labelSource, atlas.zones[1].labelSupport, atlas.zones[1].totalMarketCap], [null, null, null])
  assert.deepEqual(atlas.bundles.map((bundle) => bundle.meanCorrelation), [0.31, null])

  const panel = parseZonePanel({
    asOf: '2026-10-16', access, zoneId: 'a', label: 'A', memberCount: 4, sharedCount: 2, fidelity: 0.8,
    members: [{ symbol: 'AAA', industry: 'Chips', share: 1 }],
    subIndustries: [{ industry: 'Chips', count: 3 }, { industry: '', count: 1 }, { industry: 'X', count: 0 }],
    relevant: [{ symbol: 'AAA', name: 'A co', zoneId: 'a', share: 0.9 }, { symbol: 'BBB', share: 0 }],
    bundles: [{ zoneA: 'b', zoneB: 'a', tieCount: 3, meanCorrelation: 0.2 }, { zoneA: 'a', zoneB: 'c', tieCount: 9 }, { zoneA: 'x', zoneB: 'y', tieCount: 5 }],
  })
  assert.ok(panel)
  assert.equal(panel.sharedCount, 2)
  assert.equal(panel.members[0].industry, 'Chips')
  assert.deepEqual(panel.subIndustries, [{ industry: 'Chips', count: 3 }])
  assert.deepEqual(panel.relevant.map((item) => item.symbol), ['AAA'])
  assert.deepEqual(panel.links, [{ zoneId: 'c', tieCount: 9, meanCorrelation: null }, { zoneId: 'b', tieCount: 3, meanCorrelation: 0.2 }])
  // a local route passes the parsed panel on: it reads again unchanged
  assert.deepEqual(parseZonePanel(JSON.parse(JSON.stringify(panel))), panel)
  assert.equal(parseZonePanel({ asOf: '2026-10-16', access, zoneId: 'a' })?.sharedCount, null)

  const company = parseCompanyPanel({ asOf: '2026-10-16', access, symbol: 'AAA', zoneId: 'a', loner: true, reach: 0.4, volatility20d: 0.32 })
  assert.deepEqual([company?.loner, company?.reach, company?.volatility20d], [true, 0.4, 0.32])
  assert.equal(parseCompanyPanel({ asOf: '2026-10-16', access, symbol: 'AAA', zoneId: 'a', volatility20d: -1 })?.volatility20d, null)
})

test('cohesion dots rank regions from loose to tight, and signed out there are none', () => {
  const dots = cohesionDots([zone('a', { cohesion: 0.1 }), zone('b', { cohesion: 0.2 }), zone('c', { cohesion: 0.3 }), zone('d', { cohesion: 0.4 }), zone('e', { cohesion: 0.5 }), zone('f')])
  assert.deepEqual([...dots.entries()], [['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5]])
  assert.equal(cohesionDots([zone('a')]).size, 0)
})

test('Browse › Regions filters by name or lead ticker and sorts as asked', () => {
  const zones = [zone('alpha', { memberCount: 10, totalMarketCap: 1e9, cohesion: 0.2 }), zone('beta', { memberCount: 5, totalMarketCap: 9e9, cohesion: 0.5 }), zone('gamma_x', { memberCount: 7 })]
  const leaders = (item: AtlasZone) => (item.zoneId === 'beta' ? ['NVDA', 'AMD', 'TSM', 'ASML', 'MU'] : [])
  assert.deepEqual(browseRegions(zones, leaders).map((row) => row.zone.zoneId), ['alpha', 'gamma_x', 'beta'])
  assert.deepEqual(browseRegions(zones, leaders, { sort: 'value' }).map((row) => row.zone.zoneId), ['beta', 'alpha', 'gamma_x'])
  assert.deepEqual(browseRegions(zones, leaders, { sort: 'tight' }).map((row) => row.zone.zoneId), ['beta', 'alpha', 'gamma_x'])
  assert.deepEqual(browseRegions(zones, leaders, { term: 'amd' }).map((row) => row.zone.zoneId), ['beta'])
  assert.deepEqual(browseRegions(zones, leaders, { term: 'gamma x' }).map((row) => row.zone.zoneId), ['gamma_x'])
  assert.equal(browseRegions(zones, leaders)[2].leaders.length, 4)
  const changes = regionChanges([
    { symbol: 'A', fromZoneId: 'beta', toZoneId: 'alpha', from: null, move: 3, shareGain: 0.5, tiesIn: [], tiesOut: [], flow: true },
    { symbol: 'B', fromZoneId: 'beta', toZoneId: 'alpha', from: null, move: 3, shareGain: 0.5, tiesIn: [], tiesOut: [], flow: true },
    { symbol: 'C', fromZoneId: 'beta', toZoneId: 'alpha', from: null, move: 1, shareGain: 0, tiesIn: [], tiesOut: [], flow: false },
  ])
  assert.deepEqual(changes.get('alpha'), { joined: 2, left: 0 })
  assert.deepEqual(changes.get('beta'), { joined: 0, left: 2 })
  const sorted = browseRegions(zones, leaders, { sort: 'change', changes })
  assert.deepEqual(sorted.map((row) => [row.zone.zoneId, row.change]), [['alpha', { joined: 2, left: 0 }], ['beta', { joined: 0, left: 2 }], ['gamma_x', { joined: 0, left: 0 }]])
})

test('links, notes and metrics follow the prototype wording', () => {
  const bundles = Array.from({ length: 20 }, (_, i) => ({ zoneA: `a${i}`, zoneB: `b${i}`, tieCount: i + 1, structural: false, ties: [], meanCorrelation: i % 2 ? 0.25 : null }))
  assert.deepEqual(topLinks(bundles).map((bundle) => bundle.tieCount).slice(0, 3), [20, 19, 18])
  assert.equal(topLinks(bundles).length, 15)
  assert.equal(linkText(38, 0.314), '38 ties · 0.31')
  assert.equal(linkText(38, null), '38 ties')
  assert.equal(namingNote('industry', 'Oil_gas', 0.67), 'Named after the industry "Oil gas", which 67% of its companies share. The name is a guide; the region itself comes from prices.')
  assert.equal(namingNote(null, 'X', 0.5), null)
  assert.equal(nameSourceLine('theme', 0.5), 'Named after the theme most of them share (50%)')
  assert.equal(coverageOf({ type: 'rings', coverage: 0.75, rings: [] }), 0.75)
  assert.equal(coverageOf({ type: 'circle', x: 0, y: 0, radius: 1 }), 0.8)
  assert.equal(betweenRegions([{ zoneId: 'a', label: null, share: 0.8 }, { zoneId: 'b', label: null, share: 0.2 }]), true)
  assert.equal(betweenRegions([{ zoneId: 'a', label: null, share: 0.9 }, { zoneId: 'b', label: null, share: 0.1 }]), false)
  assert.equal(movesWithOthers(0.36, 0.72), '50%')
  assert.equal(movesWithOthers(null, 0.72), null)
})
