/**
 * Synthetic Pro and history answers for the weekly atlas, used ONLY by the
 * Playwright backend stub (E2E_STUB_TIER=pro). Not production data: the same
 * FX-prefixed "Fixture" companies as market-atlas.mjs, over 53 made-up weeks.
 *
 * The story is fixed so specs can assert it: a year ago FXA2 and FXA3 sat in
 * Fixture Beta and have since moved to Fixture Alpha; every earlier week is
 * also turned and scaled a little, as an independent weekly layout would be,
 * so the screen has to align it. Values are deterministic.
 */
import { AS_OF, FIXTURE_THEMES, MEMBERS, ZONES, atlasCompanyFixture, atlasOverviewFixture, ring } from './market-atlas.mjs'

export const PRO = { tier: 'pro', maxLevel: 3, historyWeeks: 52, lines: true, bundleTies: true, truePositions: true, movement: true, pro: true }

const DAY = 86400000
/** Newest first, a week apart. */
export const WEEKS = Array.from({ length: 53 }, (_, k) => new Date(Date.parse(`${AS_OF}T00:00:00Z`) - k * 7 * DAY).toISOString().slice(0, 10))

const MOVERS = ['FXA2', 'FXA3']
const alpha = ZONES[0]
const beta = ZONES[1]
const round = (value) => Number(value.toFixed(4))

/** Where a member was k weeks ago, on today's frame (before the weekly turn). */
function placeAt(member, k) {
  const index = MEMBERS.indexOf(member)
  if (MOVERS.includes(member.symbol)) {
    const t = Math.min(1, k / 30)
    const from = { x: beta.x + (member.symbol === 'FXA2' ? -0.4 : 0.3), y: beta.y - 0.5 }
    return { x: member.x + (from.x - member.x) * t, y: member.y + (from.y - member.y) * t, zoneId: k >= 15 ? beta.zoneId : member.zoneId }
  }
  return { x: member.x + 0.04 * Math.sin(k * 0.7 + index), y: member.y + 0.04 * Math.cos(k * 0.5 + index), zoneId: member.zoneId }
}

/** The independent layout of week k: turned by 1.2° a week and slightly larger. */
function turn(k, [x, y]) {
  const angle = k * 0.021
  const scale = 1 + k * 0.004
  return [round(scale * (x * Math.cos(angle) - y * Math.sin(angle))), round(scale * (x * Math.sin(angle) + y * Math.cos(angle)))]
}

function scaledRing(zone, factor) {
  return ring(zone).map(([x, y]) => [round(zone.x + (x - zone.x) * factor), round(zone.y + (y - zone.y) * factor)])
}

/** The Pro overview: today's map, an earlier week, or the total lens. Null for a week that does not exist. */
export function proOverviewFixture({ level, bbox, asOf, lens }) {
  const k = asOf ? WEEKS.indexOf(asOf) : 0
  if (k < 0) return null
  const base = atlasOverviewFixture({ signedIn: true, level, bbox: null })
  const total = lens === 'total'
  const move = (point) => (total ? [round(point[0] * 0.7), round(point[1] * 0.75)] : turn(k, point))
  const inBox = ([x, y]) => !bbox || (x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3])
  const nodes = base.nodes.flatMap((node) => {
    const member = MEMBERS.find((item) => item.symbol === node.symbol)
    const place = placeAt(member, k)
    const [x, y] = move([place.x, place.y])
    return inBox([x, y]) ? [{ ...node, x, y, zoneId: place.zoneId }] : []
  })
  const shown = new Set(nodes.map((node) => node.symbol))
  return {
    ...base,
    asOf: WEEKS[k],
    access: PRO,
    lens: total ? 'total' : 'residual',
    bbox: bbox ?? null,
    nodes,
    zones: base.zones.map((zone, index) => {
      const fixture = ZONES[index]
      return {
        ...zone,
        contour: { type: 'rings', coverage: 0.8, rings: [ring(fixture).map(move)] },
        // large companies count more: the outline swells around each zone's largest member
        contourByValue: total ? null : { type: 'rings', coverage: 0.8, rings: [scaledRing(fixture, 1.3).map(move)] },
      }
    }),
    // ties are today's; an earlier week keeps only those whose two companies are on it
    skeleton: base.skeleton.filter((line) => shown.has(line.source) && shown.has(line.target)),
    marketCorrelation: k ? null : base.marketCorrelation,
  }
}

export function weeksFixture() {
  return {
    access: PRO,
    weeks: WEEKS,
    cohesion: WEEKS.map((asOf, k) => ({ asOf, value: round(0.09 + 0.03 * Math.sin(k / 7) + (k === 40 ? 0.05 : 0)) })),
  }
}

const centroid = (points) => ({ x: round(points.reduce((sum, p) => sum + p.x, 0) / points.length), y: round(points.reduce((sum, p) => sum + p.y, 0) / points.length) })

export function movementFixture(from, to) {
  const k = WEEKS.indexOf(from)
  if (k <= 0 || (to && to !== WEEKS[0])) return null
  const moves = MEMBERS.map((member) => {
    const then = placeAt(member, k)
    const distance = Math.hypot(then.x - member.x, then.y - member.y)
    const mover = MOVERS.includes(member.symbol) && then.zoneId !== member.zoneId
    return {
      symbol: member.symbol,
      fromZoneId: then.zoneId,
      toZoneId: member.zoneId,
      dx: round(member.x - then.x), dy: round(member.y - then.y), distance: round(distance),
      fromX: round(then.x), fromY: round(then.y),
      move: round(distance / 0.45 + 0.4),
      shareGain: mover ? 0.55 : 0.02,
      tiesIn: mover ? ['FXA1', 'FXA4', 'FXA5'] : [],
      tiesOut: mover ? ['FXB1', 'FXB3', 'FXB5'] : [],
      flow: mover,
    }
  })
  const movers = moves.filter((move) => move.flow)
  const sorted = moves.map((move) => move.move).sort((a, b) => a - b)
  return {
    access: PRO, from, to: WEEKS[0], comparedCount: moves.length, onlyFromCount: 0, onlyToCount: 0,
    zoneChanges: movers.length,
    noise: sorted[Math.floor(sorted.length / 2)],
    moves,
    flows: movers.length >= 2 ? [{
      fromZoneId: beta.zoneId, toZoneId: alpha.zoneId, symbols: movers.map((move) => move.symbol),
      from: centroid(movers.map((move) => ({ x: move.fromX, y: move.fromY }))),
      to: centroid(movers.map((move) => MEMBERS.find((member) => member.symbol === move.symbol))),
    }] : [],
  }
}

function themeSummary(theme) {
  const zones = new Map()
  for (const symbol of theme.members) {
    const zoneId = MEMBERS.find((member) => member.symbol === symbol).zoneId
    zones.set(zoneId, (zones.get(zoneId) ?? 0) + 1)
  }
  const together = theme.themeId === 'fx-ai'
  return {
    themeId: theme.themeId, label: theme.label, memberCount: theme.members.length,
    cohesion: together ? 0.31 : 0.06, typicalCohesion: 0.42, verdict: together ? 'together' : 'apart',
    regions: [...zones].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([zoneId, count]) => ({
      zoneId, label: ZONES.find((zone) => zone.zoneId === zoneId).label, share: round(count / theme.members.length),
    })),
  }
}

export function themesFixture(access) {
  return { asOf: AS_OF, access, themes: FIXTURE_THEMES.map(themeSummary) }
}

export function themeFixture(themeId, access) {
  const theme = FIXTURE_THEMES.find((item) => item.themeId === themeId)
  if (!theme) return null
  const full = atlasOverviewFixture({ signedIn: true, level: 3, bbox: null })
  return { asOf: AS_OF, access, theme: themeSummary(theme), members: full.nodes.filter((node) => theme.members.includes(node.symbol)) }
}

export function influenceFixture() {
  const members = (zoneId) => MEMBERS.filter((member) => member.zoneId === zoneId).map((member) => member.symbol)
  return {
    asOf: AS_OF, access: PRO, tested: true, reason: null,
    arrows: [{
      from: { basket: 'zone:fx-zone-gamma', label: 'Fixture Gamma', zoneId: 'fx-zone-gamma', members: members('fx-zone-gamma') },
      to: { basket: 'sub:fixture-beta-tools', label: 'Fixture Tools (Fixture Beta)', zoneId: 'fx-zone-beta', members: ['FXB1', 'FXB2', 'FXB3'] },
      sign: -1, t: -4.4, reportDays: 152, h1: -3.1, h2: -2.9, isNew: true,
    }],
  }
}

function setLabel(key) {
  if (key.startsWith('zone:')) return { label: ZONES.find((zone) => zone.zoneId === key.slice(5))?.label ?? key, count: 6 }
  if (key.startsWith('group:')) return { label: `${key.slice(6).split(',').length} companies`, count: key.slice(6).split(',').length }
  return { label: key, count: 1 }
}

export function compareFixture(a, b) {
  if (!a || !b || a === b) return null
  const series = Array.from({ length: 38 }, (_, k) => ({ asOf: WEEKS[Math.max(0, 37 - k)], value: round(0.25 + 0.2 * Math.sin(k / 5)) }))
  return { asOf: AS_OF, access: PRO, a: setLabel(a), b: setLabel(b), series, year: 0.31, firstHalf: 0.22, secondHalf: 0.39, last3Months: 0.44 }
}

/** A selection's cohesion: a fixed synthetic mean for two or more fixture companies. */
export function setFixture(members) {
  const symbols = (members ?? '').split(',').filter(Boolean)
  const found = symbols.filter((symbol) => MEMBERS.some((member) => member.symbol === symbol))
  if (found.length < 2) return { asOf: AS_OF, access: PRO, count: symbols.length, found: found.length, meanCorrelation: null, available: false, reason: 'too_few' }
  return { asOf: AS_OF, access: PRO, count: symbols.length, found: found.length, meanCorrelation: round(0.18 + 0.01 * found.length), available: true, reason: null }
}

export function testFixture(body) {
  const from = typeof body?.from === 'string' ? body.from : null
  const to = typeof body?.to === 'string' ? body.to : null
  const run = Number.isInteger(body?.testsRun) ? body.testsRun : 1
  if (!from || !to || from === to) return null
  return {
    access: PRO, available: true, from: setLabel(from), to: setLabel(to),
    reportDays: 31, reportDaysPass: true,
    sameDayT: -3.6, direction: 'down',
    permutationP: 0.0042, threshold: 0.05 / run, permutationPPass: 0.0042 < 0.05 / run,
    reverseP: 0.41, reversePPass: true,
    firstHalfT: -2.4, secondHalfT: -2.1,
    placeboT: 0.6, placeboTPass: true,
  }
}

/** The company panel as a Pro reader gets it: tie trends on the strongest eight, and the total lens on request. */
export function proCompanyFixture(symbol, lens) {
  const answer = atlasCompanyFixture(symbol, true)
  if (answer.status !== 200) return answer
  const total = lens === 'total'
  return {
    status: 200,
    body: {
      ...answer.body,
      access: PRO,
      lens: total ? 'total' : 'residual',
      neighbours: answer.body.neighbours.map((neighbour, rank) => ({
        ...neighbour,
        correlation: total ? neighbour.total : neighbour.correlation,
        trend: rank === 0 ? 'stronger' : rank === 2 ? 'weaker' : null,
      })),
    },
  }
}
