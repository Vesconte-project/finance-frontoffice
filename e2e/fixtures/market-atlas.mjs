/**
 * Synthetic weekly atlas used ONLY by the Playwright backend stub.
 *
 * This is not production data and must never be imported by application code.
 * Every symbol carries the FX prefix and every name says "Fixture" so that a
 * screenshot or a stray log line is instantly recognisable as test-only.
 *
 * The shapes follow the backend's /v1/atlas* routes (read by lib/atlas-model.ts)
 * in their two live forms: signed out (rule 7: circles, schematic positions,
 * size steps, tie counts, at most four leaders) and free (the real map of the
 * newest week). Values are fixed rather than random so the browser suite is
 * deterministic run to run.
 */

export const AS_OF = '2026-10-16'
const SIGNED_OUT = { tier: 'signedOut', maxLevel: 1, historyWeeks: 0, lines: false, bundleTies: false, truePositions: false, movement: false, pro: false }
const FREE = { tier: 'free', maxLevel: 3, historyWeeks: 0, lines: true, bundleTies: true, truePositions: true, movement: false, pro: false }

/** Synthetic themes: which fixture companies "thematic funds" hold together. */
export const FIXTURE_THEMES = [
  { themeId: 'fx-ai', label: 'Fixture AI', members: ['FXA1', 'FXA3', 'FXB2', 'FXC1'] },
  { themeId: 'fx-robotics', label: 'Fixture Robotics', members: ['FXB4', 'FXC2', 'FXC5'] },
]
const themesOf = (symbol) => FIXTURE_THEMES.filter((theme) => theme.members.includes(symbol)).map((theme) => theme.themeId)
/** What the signed-in overview and panel say about a zone: naming, value, cohesion, accuracy. */
const ZONE_FACTS = {
  'fx-zone-alpha': { labelSupport: 0.67, dominantSector: 'Fixture Technology', cohesion: 0.42, fidelity: 0.81 },
  'fx-zone-beta': { labelSupport: 0.5, dominantSector: 'Fixture Industrials', cohesion: 0.31, fidelity: 0.74 },
  'fx-zone-gamma': { labelSupport: 0.83, dominantSector: 'Fixture Energy', cohesion: 0.18, fidelity: 0.66 },
}
function zoneFacts(zone) {
  const caps = MEMBERS.filter((member) => member.zoneId === zone.zoneId).map((member) => member.marketCap)
  // the gamma zone is worth less, so sorting by market value differs from sorting by size
  const scale = zone.zoneId === 'fx-zone-gamma' ? 0.1 : zone.zoneId === 'fx-zone-beta' ? 0.6 : 1
  return { ...ZONE_FACTS[zone.zoneId], totalMarketCap: caps.reduce((sum, cap) => sum + cap, 0) * scale }
}
const INDUSTRIES = ['Fixture Chips', 'Fixture Chips', 'Fixture Software', 'Fixture Software', 'Fixture Software', 'Fixture Services']
/** Annualised 20-day volatility per member rank; the last has none. */
const VOLATILITY = [0.21, 0.28, 0.33, 0.41, 0.52, null]

/** Map accuracy per member rank: well placed leaders, one stretched company per zone. */
const FIDELITY = [0.9, 0.8, 0.7, 0.9, 0.3, 0.6]

export const ZONES = [
  { zoneId: 'fx-zone-alpha', label: 'Fixture Alpha', x: -3, y: 1 },
  { zoneId: 'fx-zone-beta', label: 'Fixture Beta', x: 3, y: 1.5 },
  { zoneId: 'fx-zone-gamma', label: 'Fixture Gamma', x: 0, y: -2.5 },
]

/** Six members per zone on a fixed ring; the first is the largest, levels follow the feature-store cuts. */
export const MEMBERS = ZONES.flatMap((zone, zoneIndex) => Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2
  return {
    symbol: `FX${'ABC'[zoneIndex]}${i + 1}`,
    name: `Fixture ${zone.label.split(' ')[1]} Holding ${i + 1}`,
    zoneId: zone.zoneId,
    x: zone.x + Math.cos(angle) * 0.9,
    y: zone.y + Math.sin(angle) * 0.9,
    level: i === 0 ? 0 : i === 1 ? 1 : i < 4 ? 2 : 3,
    importance: 0.9 - i * 0.12,
    // from a $3T leader down to a $2B small cap, so balls span the prototype's sizes
    marketCap: [3e12, 400e9, 120e9, 40e9, 9e9, 2e9][i],
  }
}))

export function ring(zone) {
  return Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2
    return [Number((zone.x + Math.cos(angle) * 1.4).toFixed(3)), Number((zone.y + Math.sin(angle) * 1.2).toFixed(3))]
  })
}

function inBox(member, bbox) {
  if (!bbox) return true
  const [x0, y0, x1, y1] = bbox
  return member.x >= x0 && member.x <= x1 && member.y >= y0 && member.y <= y1
}

export function atlasOverviewFixture({ signedIn, level, bbox }) {
  if (!signedIn) {
    // The signed-out projection: levels 0-1 only, placed by zone and rank, circles and tie counts.
    return {
      asOf: AS_OF,
      companyCount: MEMBERS.length,
      zoneCount: ZONES.length,
      access: SIGNED_OUT,
      level,
      zones: ZONES.map((zone) => ({
        zoneId: zone.zoneId, label: zone.label, labelSource: 'industry', memberCount: 6, x: zone.x, y: zone.y,
        contour: { type: 'circle', x: zone.x, y: zone.y, radius: 1.3 },
      })),
      nodes: MEMBERS.filter((member) => member.level <= Math.min(level, 1)).map((member, rank) => ({
        symbol: member.symbol, name: member.name, zoneId: member.zoneId,
        x: Number((member.x * 0.6 + ZONES.find((zone) => zone.zoneId === member.zoneId).x * 0.4).toFixed(3)),
        y: Number((member.y * 0.6 + ZONES.find((zone) => zone.zoneId === member.zoneId).y * 0.4).toFixed(3)),
        level: member.level, size: rank % 4,
      })),
      bundles: [
        { zoneA: 'fx-zone-alpha', zoneB: 'fx-zone-beta', tieCount: 9 },
        { zoneA: 'fx-zone-alpha', zoneB: 'fx-zone-gamma', tieCount: 4 },
      ],
    }
  }
  const nodes = MEMBERS.filter((member) => member.level <= level && inBox(member, bbox))
  const shown = new Set(nodes.map((node) => node.symbol))
  return {
    asOf: AS_OF,
    previousAsOf: '2026-10-09',
    methodVersion: 'atlas-weekly/1',
    window: 252,
    companyCount: MEMBERS.length,
    zoneCount: ZONES.length,
    fidelity: 0.81,
    access: FREE,
    level,
    bbox: bbox ?? null,
    zones: ZONES.map((zone) => ({
      zoneId: zone.zoneId, label: zone.label, labelSource: 'industry', memberCount: 6,
      leaders: MEMBERS.filter((member) => member.zoneId === zone.zoneId).slice(0, 4).map((member) => member.symbol),
      contour: { type: 'rings', coverage: 0.8, rings: [ring(zone)] },
      ...zoneFacts(zone),
    })),
    nodes: nodes.map((member) => ({
      symbol: member.symbol, name: member.name, zoneId: member.zoneId, x: member.x, y: member.y, level: member.level,
      // The last member of each zone moves on its own; the first is its deepest well.
      loner: member.symbol.endsWith('6'), importance: member.importance, reach: Number((member.importance * 0.8).toFixed(4)),
      marketCap: member.marketCap, well: Number(Math.max(0, 1 - (Number(member.symbol.slice(-1)) - 1) * 0.18).toFixed(3)),
      fidelity: FIDELITY[Number(member.symbol.slice(-1)) - 1], themes: themesOf(member.symbol),
      // the second member of each zone bridges into the next zone, so it wears a ring
      memberships: member.symbol.endsWith('2')
        ? [{ zoneId: member.zoneId, share: 0.6 }, { zoneId: ZONES[(ZONES.findIndex((zone) => zone.zoneId === member.zoneId) + 1) % 3].zoneId, share: 0.4 }]
        : [{ zoneId: member.zoneId, share: 1 }],
    })),
    marketCorrelation: { value: 0.0712, comparedWithLastYear: null, weeksCompared: 1 },
    // the week's largest reach over every company, not only those on this answer
    reachMax: 0.9,
    skeleton: ZONES.flatMap((zone) => {
      const members = MEMBERS.filter((member) => member.zoneId === zone.zoneId && shown.has(member.symbol))
      return members.slice(1).map((member) => ({ source: members[0].symbol, target: member.symbol, zoneId: zone.zoneId, correlation: 0.5 }))
    }),
    bundles: FIXTURE_BUNDLES,
  }
}

/** A company's panel: signed out only the visible companies (levels 0-1), the rest refused alike. */
export function atlasCompanyFixture(symbol, signedIn) {
  const member = MEMBERS.find((item) => item.symbol === symbol)
  const zone = member && ZONES.find((item) => item.zoneId === member.zoneId)
  if (!signedIn) {
    if (!member || member.level > 1) return { status: 403, body: { detail: 'sign_in_required' } }
    return {
      status: 200,
      body: {
        asOf: AS_OF, access: SIGNED_OUT, symbol, name: member.name, sector: 'Fixture', industry: 'Fixture Industry', country: 'Testland',
        zoneId: zone.zoneId, zoneLabel: zone.label,
        zoneLeaders: MEMBERS.filter((item) => item.zoneId === zone.zoneId && item.level <= 1).slice(0, 4).map((item) => ({ symbol: item.symbol, name: item.name })),
      },
    }
  }
  if (!member) return { status: 404, body: { detail: `${symbol} is not on the atlas` } }
  const others = MEMBERS.filter((item) => item.symbol !== symbol)
  return {
    status: 200,
    body: {
      asOf: AS_OF, access: FREE, symbol, name: member.name, sector: 'Fixture', industry: 'Fixture Industry', country: 'Testland',
      zoneId: zone.zoneId, zoneLabel: zone.label, x: member.x, y: member.y, level: member.level, loner: symbol.endsWith('6'),
      memberships: [{ zoneId: zone.zoneId, label: zone.label, share: 0.85 }, { zoneId: ZONES[(ZONES.indexOf(zone) + 1) % 3].zoneId, label: ZONES[(ZONES.indexOf(zone) + 1) % 3].label, share: 0.15 }],
      neighbours: others.slice(0, 15).map((item, rank) => ({
        symbol: item.symbol, name: item.name, zoneId: item.zoneId, correlation: Number((0.62 - rank * 0.03).toFixed(4)), total: Number((0.7 - rank * 0.025).toFixed(4)),
      })),
      importance: member.importance, reach: Number((member.importance * 0.8).toFixed(4)), marketCap: member.marketCap,
      industry: INDUSTRIES[Number(symbol.slice(-1)) - 1], volatility20d: VOLATILITY[Number(symbol.slice(-1)) - 1], fidelity: FIDELITY[Number(member.symbol.slice(-1)) - 1], lens: 'residual',
      themes: FIXTURE_THEMES.filter((theme) => theme.members.includes(symbol)).map((theme) => ({ themeId: theme.themeId, label: theme.label })),
    },
  }
}

const FIXTURE_BUNDLES = [
  { zoneA: 'fx-zone-alpha', zoneB: 'fx-zone-beta', tieCount: 9, meanCorrelation: 0.31, structural: true, ties: [{ source: 'FXA1', target: 'FXB1', correlation: 0.4 }] },
  { zoneA: 'fx-zone-alpha', zoneB: 'fx-zone-gamma', tieCount: 4, meanCorrelation: 0.27, structural: true, ties: [{ source: 'FXA2', target: 'FXC1', correlation: 0.3 }] },
]

export function atlasZoneFixture(zoneId, signedIn) {
  const zone = ZONES.find((item) => item.zoneId === zoneId)
  if (!zone) return { status: 404, body: { detail: `Zone ${zoneId} is not on the atlas` } }
  const members = MEMBERS.filter((item) => item.zoneId === zoneId)
  const base = { asOf: AS_OF, zoneId, label: zone.label, labelSource: 'industry', memberCount: members.length }
  if (!signedIn) {
    return { status: 200, body: { ...base, access: SIGNED_OUT, leaders: members.filter((item) => item.level <= 1).slice(0, 4).map((item) => ({ symbol: item.symbol, name: item.name })) } }
  }
  return {
    status: 200,
    body: {
      ...base, access: FREE,
      leaders: members.slice(0, 4).map((item) => ({ symbol: item.symbol, name: item.name })),
      ...zoneFacts(zone),
      members: members.map((item, rank) => ({ symbol: item.symbol, name: item.name, level: item.level, importance: item.importance, marketCap: item.marketCap, industry: INDUSTRIES[rank], share: 0.85 })),
      sharedCount: 1,
      subIndustries: [...new Set(INDUSTRIES)].map((industry) => ({ industry, count: INDUSTRIES.filter((item) => item === industry).length })).sort((a, b) => b.count - a.count),
      // the zone's own members first, then the bridging member of the zone before it
      relevant: [
        ...members.map((item) => ({ symbol: item.symbol, name: item.name, zoneId, share: item.symbol.endsWith('2') ? 0.6 : 1 })),
        ...MEMBERS.filter((item) => item.symbol.endsWith('2') && ZONES[(ZONES.findIndex((other) => other.zoneId === item.zoneId) + 1) % 3].zoneId === zoneId)
          .map((item) => ({ symbol: item.symbol, name: item.name, zoneId: item.zoneId, share: 0.4 })),
      ].slice(0, 14),
      bundles: FIXTURE_BUNDLES.filter((bundle) => bundle.zoneA === zoneId || bundle.zoneB === zoneId),
    },
  }
}

/**
 * Ticker index for the header search that every page renders. Without it the
 * proxy answers 502 and the browser logs a resource error, which the atlas
 * specs assert against. Same synthetic symbols as the atlas.
 */
export function tickerIndexFixture() {
  return {
    items: MEMBERS.map((member) => ({
      symbol: member.symbol,
      name: member.name,
      exchange: 'FIXTURE',
      hasSignals: true,
    })),
  }
}
