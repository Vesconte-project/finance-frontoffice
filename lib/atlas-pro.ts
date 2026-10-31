/**
 * Pure logic behind the atlas's Pro and history features, after the approved
 * prototype (pro-spec §1–§8): the copy that unlocks each tool, aligning an
 * earlier week onto today's map, the time bar's frames and paths, movement and
 * influence arrows, "Then and now", the theme card, the cohesion and compare
 * charts, the link test's table, the lasso and the viewer's saved groups and
 * notebook. No DOM, so it is unit-tested directly.
 */
import type { AtlasContour, AtlasNode, AtlasPoint, AtlasZone } from './atlas-model'
import type { AtlasInfluenceArrow, AtlasMove, AtlasTest, AtlasThemeVerdict } from './atlas-pro-model'

// ------------------------------------------------------------------ tiers

export type ProFeature =
  | 'select' | 'compare' | 'test' | 'notebook' | 'groups' | 'timeline' | 'movement1y'
  | 'lens' | 'regionsize' | 'accuracy' | 'influence' | 'cohesion'

/** The upsell's title and text per locked feature (prototype v27 §8; the timeline line follows ENG-232). */
export const PRO_COPY: Record<ProFeature, [string, string]> = {
  select: ['Select companies', 'Draw around companies, or shift-click them, to work with them as a group: compare, test, save.'],
  compare: ['Compare', 'How two companies, groups or regions have moved together over the last year, week by week.'],
  test: ['Test a link', 'Run the influence test on two groups you choose, with its numbers: report days, reverse direction, both halves, placebo.'],
  notebook: ['Notebook', 'Save views, selections and tests with your notes, and open them again later on current data.'],
  groups: ['Groups', 'Save a selection as a group to come back to it, compare it or test it.'],
  timeline: ['A year of history', 'Earlier weeks, and how companies moved between regions, are part of Pro.'],
  movement1y: ['Movement over a year', 'Which companies moved between regions over the last twelve months.'],
  lens: ['Total co-movement', "The map of what moves together including the whole market's daily move: what falls together on a bad day."],
  regionsize: ['Region size', 'Size regions by market value instead of by number of companies.'],
  accuracy: ['Map accuracy', 'A ring on each company showing how well the flat map places it.'],
  influence: ['Influence arrows', 'Arrows between groups when one moves the other on its report days, repeatedly.'],
  cohesion: ['Market cohesion', 'Average correlation across the market, week by week, over the last year.'],
}

/** Movement spans the control offers, in weeks. */
export type MovementSpan = 0 | 26 | 52

/** "6 months ago", "a year ago": how far back a span reaches. */
export function spanAgo(span: number): string {
  if (span === 13) return '3 months ago'
  if (span === 26) return '6 months ago'
  if (span === 52) return 'a year ago'
  return `${span} weeks ago`
}

// ------------------------------------------------------------------ alignment

/** A 2D similarity (rotation, optional reflection, scale) about two centres. */
export type Similarity = { m: [number, number, number, number]; from: AtlasPoint; to: AtlasPoint }

export const IDENTITY: Similarity = { m: [1, 0, 0, 1], from: [0, 0], to: [0, 0] }

export function applySimilarity(transform: Similarity, [x, y]: AtlasPoint): AtlasPoint {
  const [a, b, c, d] = transform.m
  const px = x - transform.from[0]
  const py = y - transform.from[1]
  return [a * px + b * py + transform.to[0], c * px + d * py + transform.to[1]]
}

/**
 * Procrustes: the rotation (or reflection), scale and shift that lay `source`
 * points best onto `target` (least squares). Needs three pairs; fewer gives null.
 */
export function procrustes(source: readonly AtlasPoint[], target: readonly AtlasPoint[]): Similarity | null {
  const n = Math.min(source.length, target.length)
  if (n < 3) return null
  const mean = (points: readonly AtlasPoint[]): AtlasPoint => {
    let x = 0
    let y = 0
    for (let i = 0; i < n; i += 1) {
      x += points[i][0]
      y += points[i][1]
    }
    return [x / n, y / n]
  }
  const ps = mean(source)
  const qs = mean(target)
  let dot = 0
  let cross = 0
  let dotFlip = 0
  let crossFlip = 0
  let norm = 0
  for (let i = 0; i < n; i += 1) {
    const px = source[i][0] - ps[0]
    const py = source[i][1] - ps[1]
    const qx = target[i][0] - qs[0]
    const qy = target[i][1] - qs[1]
    dot += px * qx + py * qy
    cross += px * qy - py * qx
    // the same with the source mirrored (y → −y)
    dotFlip += px * qx - py * qy
    crossFlip += px * qy + py * qx
    norm += px * px + py * py
  }
  if (norm <= 1e-12) return null
  const keep = Math.hypot(dot, cross)
  const flip = Math.hypot(dotFlip, crossFlip)
  const mirrored = flip > keep + 1e-12
  const fit = mirrored ? flip : keep
  const angle = mirrored ? Math.atan2(crossFlip, dotFlip) : Math.atan2(cross, dot)
  const scale = fit / norm
  const cos = Math.cos(angle) * scale
  const sin = Math.sin(angle) * scale
  // rotation R·(x, y), after the mirror (x, −y) when it fits better
  const m: Similarity['m'] = mirrored ? [cos, sin, sin, -cos] : [cos, -sin, sin, cos]
  return { m, from: ps, to: qs }
}

function transformContour(contour: AtlasContour | null, transform: Similarity, scale: number): AtlasContour | null {
  if (!contour) return null
  if (contour.type === 'circle') {
    const [x, y] = applySimilarity(transform, [contour.x, contour.y])
    return { type: 'circle', x, y, radius: contour.radius * scale }
  }
  return { ...contour, rings: contour.rings.map((ring) => ring.map((point) => applySimilarity(transform, point))) }
}

/** One earlier week, laid onto today's map. */
export type WeekFrame = { asOf: string; nodes: AtlasNode[]; zones: AtlasZone[]; positions: Map<string, AtlasPoint> }

/**
 * An earlier week's map aligned to today's positions over the companies both
 * share, so the bar shows how companies moved and not how the layout spun.
 * Null when fewer than three companies are shared.
 */
export function alignWeek(asOf: string, nodes: readonly AtlasNode[], zones: readonly AtlasZone[], today: ReadonlyMap<string, AtlasPoint>): WeekFrame | null {
  const source: AtlasPoint[] = []
  const target: AtlasPoint[] = []
  for (const node of nodes) {
    const now = today.get(node.symbol)
    if (!now) continue
    source.push([node.x, node.y])
    target.push(now)
  }
  const transform = procrustes(source, target)
  if (!transform) return null
  const scale = Math.hypot(transform.m[0], transform.m[2])
  const aligned = nodes.map((node) => {
    const [x, y] = applySimilarity(transform, [node.x, node.y])
    return { ...node, x, y }
  })
  return {
    asOf,
    nodes: aligned,
    zones: zones.map((zone) => {
      const anchor = zone.x !== null && zone.y !== null ? applySimilarity(transform, [zone.x, zone.y]) : null
      return {
        ...zone,
        x: anchor ? anchor[0] : null,
        y: anchor ? anchor[1] : null,
        contour: transformContour(zone.contour, transform, scale),
        contourByValue: transformContour(zone.contourByValue, transform, scale),
      }
    }),
    positions: new Map(aligned.map((node) => [node.symbol, [node.x, node.y] as AtlasPoint])),
  }
}

/** Today's frame: the map on screen, unchanged. */
export function todayFrame(asOf: string, nodes: readonly AtlasNode[], zones: readonly AtlasZone[]): WeekFrame {
  return { asOf, nodes: [...nodes], zones: [...zones], positions: new Map(nodes.map((node) => [node.symbol, [node.x, node.y] as AtlasPoint])) }
}

/**
 * The map at a fractional week `week` (0 = today, k = k weeks earlier) during
 * play: positions move linearly between the two frames around it, regions are
 * those of the nearer week. `frames[k]` may be missing while it loads; the
 * nearest loaded frame stands in.
 */
export function frameAt(frames: ReadonlyArray<WeekFrame | undefined>, week: number): WeekFrame | null {
  if (!frames.length) return null
  const clamped = Math.max(0, Math.min(frames.length - 1, week))
  const nearest = (k: number): WeekFrame | null => {
    for (let d = 0; d < frames.length; d += 1) {
      const a = frames[k - d]
      if (a) return a
      const b = frames[k + d]
      if (b) return b
    }
    return null
  }
  const base = nearest(Math.round(clamped))
  if (!base) return null
  const lower = frames[Math.floor(clamped)]
  const upper = frames[Math.ceil(clamped)]
  const t = clamped - Math.floor(clamped)
  if (!lower || !upper || lower === upper || t === 0) return base
  const nodes = base.nodes.map((node) => {
    const a = lower.positions.get(node.symbol)
    const b = upper.positions.get(node.symbol)
    if (!a || !b) return node
    return { ...node, x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t }
  })
  return { ...base, nodes, positions: new Map(nodes.map((node) => [node.symbol, [node.x, node.y] as AtlasPoint])) }
}

/** A company's path from `span` weeks ago to the week shown, ending at where it is drawn now. */
/**
 * Where a company goes from the week shown to today: its place that week (`at`), then each later
 * week's, ending where it sits now. Empty when fewer than two points are known.
 */
export function pathOf(symbol: string, frames: ReadonlyArray<WeekFrame | undefined>, week: number, at: AtlasPoint | null): AtlasPoint[] {
  const points: AtlasPoint[] = at ? [at] : []
  for (let k = Math.min(Math.ceil(Math.max(0, week)) - 1, frames.length - 1); k >= 0; k -= 1) {
    const point = frames[k]?.positions.get(symbol)
    if (point) points.push(point)
  }
  return points.length >= 2 ? points : []
}

/** The time bar's date: "Today", or the week's own date. */
export function weekLabel(weeks: readonly string[], week: number): string {
  const k = Math.round(week)
  return k <= 0 ? 'Today' : weeks[Math.min(k, weeks.length - 1)] ?? 'Today'
}

/**
 * The note above the time bar on an earlier week. `movers` is how many companies changed region
 * between that week and today, or null while it is being read.
 */
export function timelineNote(since: string, movers: number | null, selected: { symbol: string; changed: boolean | null } | null): string {
  if (selected) {
    const tail = selected.changed === null ? '' : selected.changed ? ' · it changed region' : ' · it kept its region'
    return `Path of ${selected.symbol} since ${since}${tail}`
  }
  if (movers === null) return `Since ${since}: finding the companies that changed region…`
  if (movers === 0) return `Since ${since}: no company changed region`
  return `Since ${since}: ${movers} ${movers === 1 ? 'company' : 'companies'} changed region · select one to see its path`
}

/**
 * The companies that really changed region between two weeks: the backend's own test
 * (a new main region, its weight there up, and most of its strongest ties replaced).
 */
export function regionMovers(movement: { moves: ReadonlyArray<{ symbol: string; flow: boolean }> } | null): Set<string> {
  return new Set(movement ? movement.moves.filter((move) => move.flow).map((move) => move.symbol) : [])
}

/**
 * The time bar tracks movers for the week it shows, one read at a time: until that week's read
 * lands, the nearest week already read stands in, so the marks follow a drag without flicker.
 */
export function trackedWeek(week: number, read: Iterable<number>): number | null {
  let best: number | null = null
  for (const candidate of read) {
    if (candidate <= 0) continue
    if (best === null || Math.abs(candidate - week) < Math.abs(best - week) || (Math.abs(candidate - week) === Math.abs(best - week) && candidate < best)) best = candidate
  }
  return best
}

/** Where the week is after `elapsed` ms of play: 52 weeks in 9 s, whole weeks with reduced motion. */
export function playWeek(from: number, elapsed: number, reduced: boolean): number {
  const week = Math.max(0, from - (Math.max(0, elapsed) / 9000) * 52)
  return reduced ? Math.ceil(week) : week
}

// ------------------------------------------------------------------ arrows

export type CurvedArrow = {
  start: AtlasPoint
  control: AtlasPoint
  /** Where the line stops, short of the tip, so the head closes it. */
  end: AtlasPoint
  tip: AtlasPoint
  head: [AtlasPoint, AtlasPoint, AtlasPoint]
  width: number
}

/** A filled triangle with its tip at (x, y), pointing along (ux, uy), of size s. */
export function arrowHead([x, y]: AtlasPoint, ux: number, uy: number, s: number): [AtlasPoint, AtlasPoint, AtlasPoint] {
  return [[x, y], [x - ux * s - uy * s * 0.6, y - uy * s + ux * s * 0.6], [x - ux * s + uy * s * 0.6, y - uy * s - ux * s * 0.6]]
}

function curved(start: AtlasPoint, tip: AtlasPoint, bow: number, width: number, head: number, cut: number): CurvedArrow | null {
  const dx = tip[0] - start[0]
  const dy = tip[1] - start[1]
  if (Math.hypot(dx, dy) < 12) return null
  const control: AtlasPoint = [(start[0] + tip[0]) / 2 - dy * bow, (start[1] + tip[1]) / 2 + dx * bow]
  const tx = tip[0] - control[0]
  const ty = tip[1] - control[1]
  const length = Math.hypot(tx, ty) || 1
  const ux = tx / length
  const uy = ty / length
  return { start, control, end: [tip[0] - ux * head * cut, tip[1] - uy * head * cut], tip, head: arrowHead(tip, ux, uy, head), width }
}

/** A movement arrow in screen space: bows to one side, wider for more companies (pro-spec §2c). */
export function flowArrow(start: AtlasPoint, tip: AtlasPoint, count: number): CurvedArrow | null {
  const width = 1.5 + 1.6 * Math.sqrt(count)
  return curved(start, tip, 0.18, width, 6 + 1.6 * width, 0.8)
}

/** An influence arrow: bows to the other side, wider for a stronger test (pro-spec §3c). */
export function influenceArrow(start: AtlasPoint, tip: AtlasPoint, t: number): CurvedArrow | null {
  const width = Math.max(1, 2 + Math.min(4, Math.abs(t) - 3))
  return curved(start, tip, -0.22, width, 9 + width, 0.8)
}

/** A point along a quadratic curve. */
export function along(arrow: CurvedArrow, t: number): AtlasPoint {
  const u = 1 - t
  return [
    u * u * arrow.start[0] + 2 * u * t * arrow.control[0] + t * t * arrow.tip[0],
    u * u * arrow.start[1] + 2 * u * t * arrow.control[1] + t * t * arrow.tip[1],
  ]
}

/** Where a basket sits on the map: the centre of its members on screen, else its region's centre. */
export function basketCentre(members: readonly string[], positions: ReadonlyMap<string, AtlasPoint>, fallback: AtlasPoint | null): AtlasPoint | null {
  let x = 0
  let y = 0
  let n = 0
  for (const symbol of members) {
    const point = positions.get(symbol)
    if (!point) continue
    x += point[0]
    y += point[1]
    n += 1
  }
  return n ? [x / n, y / n] : fallback
}

/** A basket's name without the region it sits in: "Glass (Materials)" reads "Glass". */
export function shortBasket(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').replace(/_/g, ' ').trim() || label
}

export function influencePill(arrow: AtlasInfluenceArrow): string {
  return `${shortBasket(arrow.from.label)} → ${shortBasket(arrow.to.label)} ${arrow.sign < 0 ? '↓' : '↑'}${arrow.isNew ? ' · new' : ''}`
}

/** The landmarks card's sentence for one arrow (pro-spec §3c). */
export function influenceSentence(arrow: AtlasInfluenceArrow): string {
  return `When ${shortBasket(arrow.from.label)} companies report results, ${shortBasket(arrow.to.label)} ${arrow.sign < 0 ? 'falls' : 'rises'} the same day, and not the other way round. Seen on ${arrow.reportDays} report days, in both years${arrow.isNew ? '; not seen a year earlier' : ''}.`
}

// ------------------------------------------------------------------ then and now

export type ThenAndNow = {
  when: string
  changed: boolean
  verdict: string
  /** The region line, in parts: plain text and region names to set in bold. */
  region: Array<{ text: string; bold?: boolean }>
  movement: string | null
  tiesIn: string[]
  tiesOut: string[]
}

/** The company panel's "Then and now", from its move against `span` weeks ago (pro-spec §2c). */
export function thenAndNow(move: AtlasMove, noise: number | null, span: number, labelOf: (zoneId: string) => string): ThenAndNow {
  const region: ThenAndNow['region'] = move.fromZoneId !== move.toZoneId
    ? [{ text: 'Main region: ' }, { text: labelOf(move.fromZoneId), bold: true }, { text: ' → ' }, { text: labelOf(move.toZoneId), bold: true }]
    : move.shareGain !== null && move.shareGain >= 0.1
      ? [{ text: 'Weight moved toward ' }, { text: labelOf(move.toZoneId), bold: true }, { text: ` (+${Math.round(move.shareGain * 100)} pts)` }]
      : [{ text: 'Same regions, similar weight' }]
  const ratio = move.move !== null && noise ? move.move / noise : null
  return {
    when: spanAgo(span),
    changed: move.flow,
    verdict: move.flow ? `Moved to ${labelOf(move.toZoneId)}` : 'Within normal variation',
    region,
    movement: ratio === null ? null : ratio >= 1.5 ? `Moved ${ratio.toFixed(1)}× more than a typical company` : 'Moved about as much as a typical company',
    tiesIn: move.tiesIn,
    tiesOut: move.tiesOut,
  }
}

// ------------------------------------------------------------------ themes

export const THEME_VERDICTS: Record<AtlasThemeVerdict, [string, string]> = {
  together: ['Moves together', 'Prices confirm the theme.'],
  loose: ['Moves together loosely', 'Partly confirmed by prices.'],
  apart: ["Doesn't move together", 'A label the prices do not confirm: its companies move with their own regions.'],
}

// ------------------------------------------------------------------ charts

export type CohesionChart = { points: string; lo: number; hi: number; last: number; lastX: number; lastY: number; label: string; yLo: number; yHi: number }

/** The "Market cohesion, last year" sparkline (pro-spec §5d): 300×76, one point per week with a value. */
export function cohesionChart(values: ReadonlyArray<number | null>): CohesionChart | null {
  const known = values.map((value, k) => [k, value] as const).filter((entry): entry is readonly [number, number] => entry[1] !== null)
  if (known.length < 2) return null
  const lo = Math.min(...known.map(([, value]) => value))
  const hi = Math.max(...known.map(([, value]) => value))
  const span = Math.max(1, values.length - 1)
  const x = (k: number) => (k / span) * 292 + 4
  const y = (v: number) => 76 - 14 - ((v - lo) / (hi - lo || 1)) * 46
  const [lastK, last] = known[known.length - 1]
  return {
    points: known.map(([k, value]) => `${x(k).toFixed(1)},${y(value).toFixed(1)}`).join(' '),
    lo,
    hi,
    last,
    lastX: x(lastK),
    lastY: y(last),
    yLo: y(lo),
    yHi: y(hi),
    label: `Average correlation over the last year, from ${lo.toFixed(2)} to ${hi.toFixed(2)}; today ${last.toFixed(2)}`,
  }
}

export type CompareChart = { path: string; zero: number; half: number }

/** The Compare dock's line (pro-spec §7): 560×120, clamped to −0.4…1. */
export function compareChart(values: readonly number[]): CompareChart | null {
  if (values.length < 2) return null
  const x = (k: number) => 6 + (k / (values.length - 1)) * 548
  const y = (v: number) => 120 - 12 - ((Math.max(-0.4, Math.min(1, v)) + 0.4) / 1.4) * 96
  return { path: values.map((value, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(value).toFixed(1)}`).join(''), zero: y(0), half: y(0.5) }
}

// ------------------------------------------------------------------ test a link

export type TestRow = { label: string; value: string; pass: boolean; rule: string }

const fixed = (value: number | null, digits: number) => (value === null ? '—' : value.toFixed(digits))

/**
 * The link test's table (pro-spec §7), with the platform's thresholds; the
 * backend's own pass marks win where it sends them. Null when not available.
 */
export function testRows(result: AtlasTest, testsRun: number): TestRow[] | null {
  if (!result.available) return null
  const k = Math.max(1, testsRun)
  const bar = result.threshold ?? 0.05 / k
  const sign = result.direction === 'down' ? -1 : result.direction === 'up' ? 1 : Math.sign(result.sameDayT.value ?? 0)
  const n = result.reportDays.value
  const p = result.permutationP.value
  const back = result.reverseP.value
  const h1 = result.firstHalfT.value
  const h2 = result.secondHalfT.value
  const placebo = result.placeboT.value
  const steady = h1 !== null && h2 !== null && Math.sign(h1) === sign && Math.sign(h2) === sign && Math.abs(h1) >= 1.5 && Math.abs(h2) >= 1.5
  const pick = (given: boolean | null, computed: boolean) => (given === null ? computed : given)
  return [
    { label: 'Report days', value: n === null ? '—' : String(Math.round(n)), pass: pick(result.reportDays.pass, n !== null && n >= 12), rule: '≥ 12' },
    { label: 'Same-day response (t)', value: fixed(result.sameDayT.value, 1), pass: true, rule: sign < 0 ? 'down' : 'up' },
    {
      label: 'Permutation p',
      value: p === null ? '—' : p < 1e-4 ? p.toExponential(1) : p.toFixed(4),
      pass: pick(result.permutationP.pass, p !== null && p < bar),
      rule: `< ${bar < 1e-3 ? bar.toExponential(1) : bar.toFixed(3)} (0.05 ÷ ${k} tests)`,
    },
    { label: 'Reverse direction p', value: fixed(back, 2), pass: pick(result.reverseP.pass, back !== null && back > 0.2), rule: '> 0.20' },
    {
      label: 'First half / second half (t)',
      value: `${fixed(h1, 1)} / ${fixed(h2, 1)}`,
      pass: result.firstHalfT.pass !== null && result.secondHalfT.pass !== null ? result.firstHalfT.pass && result.secondHalfT.pass : steady,
      rule: 'same sign, |t| ≥ 1.5',
    },
    { label: 'Placebo, dates +10 days (t)', value: fixed(placebo, 1), pass: pick(result.placeboT.pass, placebo !== null && Math.abs(placebo) < 2), rule: '|t| < 2' },
  ]
}

// ------------------------------------------------------------------ selection

/** Is a screen point inside a polygon (ray casting)? */
export function insidePolygon(polygon: readonly AtlasPoint[], x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export type SelectionSummary = { companies: number; regions: number; marketCap: number | null }

/** The tray's line: how many companies, in how many regions, and their market value where known. */
export function selectionSummary(symbols: ReadonlySet<string>, nodes: ReadonlyMap<string, AtlasNode>): SelectionSummary {
  const regions = new Set<string>()
  let cap = 0
  let known = false
  for (const symbol of symbols) {
    const node = nodes.get(symbol)
    if (!node) continue
    regions.add(node.zoneId)
    if (node.marketCap !== null) {
      cap += node.marketCap
      known = true
    }
  }
  return { companies: symbols.size, regions: regions.size, marketCap: known ? cap : null }
}

/** A set's key for the backend from a selection or a group. */
export function groupKey(symbols: Iterable<string>): string {
  return `group:${[...new Set(symbols)].sort().slice(0, 200).join(',')}`
}

// ------------------------------------------------------------------ accuracy

/** "7.4 of 10": the mean map accuracy of the companies that carry one. */
export function meanAccuracy(nodes: readonly AtlasNode[]): string | null {
  const values = nodes.map((node) => node.fidelity).filter((value): value is number => value !== null)
  if (!values.length) return null
  return `${((values.reduce((sum, value) => sum + value, 0) / values.length) * 10).toFixed(1)} of 10`
}

/**
 * The selected company's strong ties that the flat map could not keep near it:
 * of its ten strongest, those not among its ten nearest companies on screen.
 */
export function farTies(symbol: string, neighbours: readonly string[], nodes: readonly AtlasNode[]): string[] {
  const self = nodes.find((node) => node.symbol === symbol)
  if (!self) return []
  const nearest = nodes
    .filter((node) => node.symbol !== symbol)
    .map((node) => [node.symbol, Math.hypot(node.x - self.x, node.y - self.y)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .map(([other]) => other)
  const near = new Set(nearest)
  const shown = new Set(nodes.map((node) => node.symbol))
  return neighbours.slice(0, 10).filter((other) => shown.has(other) && !near.has(other))
}

// ------------------------------------------------------------------ the viewer's own lists

export const GROUPS_KEY = 'atlas_groups_v1'
export const NOTEBOOK_KEY = 'atlas_notebook_v1'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** The browser's storage, or null where it is blocked (private windows, previews). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    return null
  }
}

export function loadList(storage: StorageLike | null, key: string): unknown[] {
  if (!storage) return []
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

/** Saves a list; false when storage refused it (kept for this visit only). */
export function saveList(storage: StorageLike | null, key: string, value: unknown[]): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export type AtlasGroup = { id: string; name: string; members: string[] }

type Raw = Record<string, unknown>
const asRecord = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null)
const asText = (value: unknown, limit = 120): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null)
const asSymbols = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.map((item) => asText(item, 24)).filter((item): item is string => item !== null))].slice(0, 200) : []

export function parseGroups(values: unknown[]): AtlasGroup[] {
  const groups: AtlasGroup[] = []
  for (const value of values) {
    const raw = asRecord(value)
    const id = asText(raw?.id, 40)
    const name = asText(raw?.name)
    const members = asSymbols(raw?.members)
    if (id && name && members.length && !groups.some((group) => group.id === id)) groups.push({ id, name, members })
  }
  return groups
}

export type NotebookView = {
  week: number
  cmp: MovementSpan
  theme: string | null
  lens: 'residual' | 'total'
  node: string | null
  zone: string | null
  multi: string[]
  layers: { inf: boolean; fid: boolean; cap: boolean }
  cam: { cx: number; cy: number; k: number } | null
  dock: { kind: 'compare' | 'test'; a: string; b: string } | null
}

export type NotebookEntry = { id: string; title: string; savedAt: string; note: string; view: NotebookView }

function parseView(value: unknown): NotebookView | null {
  const raw = asRecord(value)
  if (!raw) return null
  const number = (item: unknown) => (typeof item === 'number' && Number.isFinite(item) ? item : null)
  const layers = asRecord(raw.layers)
  const cam = asRecord(raw.cam)
  const dock = asRecord(raw.dock)
  const cx = number(cam?.cx)
  const cy = number(cam?.cy)
  const k = number(cam?.k)
  const kind = dock?.kind === 'compare' || dock?.kind === 'test' ? dock.kind : null
  const a = asText(dock?.a, 4000)
  const b = asText(dock?.b, 4000)
  return {
    week: Math.max(0, Math.round(number(raw.week) ?? 0)),
    cmp: raw.cmp === 26 || raw.cmp === 52 ? raw.cmp : 0,
    theme: asText(raw.theme, 64),
    lens: raw.lens === 'total' ? 'total' : 'residual',
    node: asText(raw.node, 24),
    zone: asText(raw.zone, 80),
    multi: asSymbols(raw.multi),
    layers: { inf: layers?.inf === true, fid: layers?.fid === true, cap: layers?.cap === true },
    cam: cx !== null && cy !== null && k !== null && k > 0 ? { cx, cy, k } : null,
    dock: kind && a && b ? { kind, a, b } : null,
  }
}

export function parseNotes(values: unknown[]): NotebookEntry[] {
  const notes: NotebookEntry[] = []
  for (const value of values) {
    const raw = asRecord(value)
    const id = asText(raw?.id, 40)
    const title = asText(raw?.title)
    const savedAt = asText(raw?.savedAt, 40)
    const view = parseView(raw?.view)
    if (!id || !title || !savedAt || !view || notes.some((note) => note.id === id)) continue
    notes.push({ id, title, savedAt, note: typeof raw?.note === 'string' ? raw.note.slice(0, 4000) : '', view })
  }
  return notes
}

/** A saved view's title: the company, the region, the selection or the whole market. */
export function noteTitle(view: NotebookView, zoneLabel: string | null): string {
  return view.node ?? zoneLabel ?? (view.multi.length ? `${view.multi.length} companies` : 'Whole market')
}

/** A saved view's details line: "{N} weeks ago|today · {n} selected · {dock} · influence". */
export function noteDetails(view: NotebookView): string {
  return [
    view.week ? `${view.week} weeks ago` : 'today',
    view.multi.length ? `${view.multi.length} selected` : '',
    view.dock ? view.dock.kind : '',
    view.layers.inf ? 'influence' : '',
  ].filter(Boolean).join(' · ')
}
