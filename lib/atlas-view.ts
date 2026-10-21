/**
 * Pure geometry for drawing the atlas: the camera, the zoom-to-level rule,
 * hit testing, zone colours, the ground's wells, the bundles between regions,
 * search and the "Most connected" list. No DOM, so it is unit-tested directly.
 */
import type { AtlasBundle, AtlasContour, AtlasMarketCorrelation, AtlasNode, AtlasOverview, AtlasPoint, AtlasZone } from './atlas-model'

export type Bounds = { x0: number; y0: number; x1: number; y1: number }
/** `pitch` tilts the ground away from the reader, in radians; 0 looks straight down. */
export type Camera = { cx: number; cy: number; k: number; pitch: number }
export type Viewport = { width: number; height: number }

/** The tilt that shows the ground's wells; a map without wells is drawn straight down. */
export const RELIEF_PITCH = (38 * Math.PI) / 180

/** Zoom, relative to the whole-map fit, at which each detail level appears. */
export const LEVEL_ZOOM = [0, 1.7, 3, 5] as const
export const MIN_ZOOM = 0.6
export const MAX_ZOOM = 24

function extend(bounds: Bounds, x: number, y: number): Bounds {
  return { x0: Math.min(bounds.x0, x), y0: Math.min(bounds.y0, y), x1: Math.max(bounds.x1, x), y1: Math.max(bounds.y1, y) }
}

function contourPoints(contour: AtlasContour | null): AtlasPoint[] {
  if (!contour) return []
  if (contour.type === 'circle') {
    return [[contour.x - contour.radius, contour.y - contour.radius], [contour.x + contour.radius, contour.y + contour.radius]]
  }
  return contour.rings.flat()
}

/** Everything drawn: companies, zone outlines and labels. */
export function atlasBounds(atlas: Pick<AtlasOverview, 'nodes' | 'zones'>): Bounds {
  let bounds: Bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (const node of atlas.nodes) bounds = extend(bounds, node.x, node.y)
  for (const zone of atlas.zones) {
    for (const [x, y] of contourPoints(zone.contour)) bounds = extend(bounds, x, y)
    if (zone.x !== null && zone.y !== null) bounds = extend(bounds, zone.x, zone.y)
  }
  if (!Number.isFinite(bounds.x0)) return { x0: -1, y0: -1, x1: 1, y1: 1 }
  const pad = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0, 1) * 0.04
  return { x0: bounds.x0 - pad, y0: bounds.y0 - pad, x1: bounds.x1 + pad, y1: bounds.y1 + pad }
}

/** Space the controls take at each edge of the viewport, in CSS pixels; the map fits in what is left. */
export type Insets = { top: number; right: number; bottom: number; left: number }
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** The camera that shows `bounds` whole inside the viewport less its insets, at the given tilt. */
export function fitCamera(bounds: Bounds, viewport: Viewport, pitch = 0, insets: Insets = NO_INSETS): Camera {
  const areaWidth = Math.max(80, viewport.width - insets.left - insets.right)
  const areaHeight = Math.max(80, viewport.height - insets.top - insets.bottom)
  const width = Math.max(1e-6, bounds.x1 - bounds.x0)
  const height = Math.max(1e-6, bounds.y1 - bounds.y0) * Math.cos(pitch)
  const fitted = Math.min(areaWidth / width, areaHeight / height)
  const k = Number.isFinite(fitted) && fitted > 0 ? fitted : 1
  // Centre the map in the free area, which may sit off the viewport's centre.
  const dx = insets.left + areaWidth / 2 - viewport.width / 2
  const dy = insets.top + areaHeight / 2 - viewport.height / 2
  return { cx: (bounds.x0 + bounds.x1) / 2 - dx / k, cy: (bounds.y0 + bounds.y1) / 2 + dy / (k * Math.cos(pitch)), k, pitch }
}

/**
 * Map units to CSS pixels. North is up: a larger y is higher on screen. `z` is
 * height above the ground (negative inside a well); it only shows when tilted.
 */
export function toScreen(camera: Camera, viewport: Viewport, x: number, y: number, z = 0): AtlasPoint {
  return [
    viewport.width / 2 + (x - camera.cx) * camera.k,
    viewport.height / 2 - ((y - camera.cy) * Math.cos(camera.pitch) + z * Math.sin(camera.pitch)) * camera.k,
  ]
}

/** The ground point (z = 0) under a pixel. */
export function toWorld(camera: Camera, viewport: Viewport, px: number, py: number): AtlasPoint {
  return [camera.cx + (px - viewport.width / 2) / camera.k, camera.cy - (py - viewport.height / 2) / (camera.k * Math.cos(camera.pitch))]
}

/** Move the camera by a drag of (dx, dy) pixels, so the ground follows the pointer. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, cx: camera.cx - dx / camera.k, cy: camera.cy + dy / (camera.k * Math.cos(camera.pitch)) }
}

/** Zoom by `factor` keeping the point under (px, py) still, within the allowed range of the fit. */
export function zoomAt(camera: Camera, viewport: Viewport, fitK: number, factor: number, px: number, py: number): Camera {
  const k = Math.max(fitK * MIN_ZOOM, Math.min(fitK * MAX_ZOOM, camera.k * factor))
  const [wx, wy] = toWorld(camera, viewport, px, py)
  return { ...camera, k, cx: wx - (px - viewport.width / 2) / k, cy: wy + (py - viewport.height / 2) / (k * Math.cos(camera.pitch)) }
}

/** The deepest level the zoom shows, capped by what this reader may load. */
export function levelForZoom(zoom: number, maxLevel: number): number {
  let level = 0
  for (let candidate = 0; candidate < LEVEL_ZOOM.length; candidate += 1) if (zoom >= LEVEL_ZOOM[candidate]) level = candidate
  return Math.min(level, maxLevel)
}

/** The visible part of the map, in map units, as `x0,y0,x1,y1`. */
export function visibleBounds(camera: Camera, viewport: Viewport): Bounds {
  const [x0, y1] = toWorld(camera, viewport, 0, 0)
  const [x1, y0] = toWorld(camera, viewport, viewport.width, viewport.height)
  return { x0, y0, x1, y1 }
}

/** Does `inner` lie inside `outer`? An area already loaded needs no new request. */
export function covers(outer: Bounds, inner: Bounds): boolean {
  return inner.x0 >= outer.x0 && inner.y0 >= outer.y0 && inner.x1 <= outer.x1 && inner.y1 <= outer.y1
}

/** Grow an area by a share of its size, so small pans stay inside what was loaded. */
export function padBounds(bounds: Bounds, share: number): Bounds {
  const dx = (bounds.x1 - bounds.x0) * share
  const dy = (bounds.y1 - bounds.y0) * share
  return { x0: bounds.x0 - dx, y0: bounds.y0 - dy, x1: bounds.x1 + dx, y1: bounds.y1 + dy }
}

/** The approved prototype's map is 70 of its ball units across its shorter side. */
const BALL_UNITS = 70

/** The map's shorter side on screen at the whole-map fit, in CSS pixels: what ball sizes scale with. */
export function mapExtent(bounds: Bounds, fit: Camera): number {
  return fit.k * Math.min(bounds.x1 - bounds.x0, (bounds.y1 - bounds.y0) * Math.cos(fit.pitch))
}

/**
 * A ball's radius in CSS pixels, as the prototype draws it: its bulk against the map's size, growing with
 * the square root of the zoom, never under 1.4 px.
 */
export function ballRadius(bulk: number, zoom: number, extent: number): number {
  return Math.max(1.4, (bulk / BALL_UNITS) * extent * Math.sqrt(Math.max(0, zoom)))
}

/** A ball's ring: a company whose strongest ties are at least 15% outside its main region. */
export function ringShares(node: AtlasNode): AtlasNode['memberships'] {
  const [main] = node.memberships
  return node.memberships.length > 1 && main && 1 - main.share >= 0.15 ? node.memberships : []
}

export type Placement = {
  /** Height of a company's ball above the ground plane (negative inside a well). */
  z?: (node: AtlasNode) => number
  /** Its radius on screen. */
  radius?: (node: AtlasNode) => number
}

/** The company under a pointer, if any is within reach. */
export function nodeAt(
  nodes: readonly AtlasNode[],
  camera: Camera,
  viewport: Viewport,
  px: number,
  py: number,
  reach = 10,
  placement: Placement = {},
): AtlasNode | null {
  let best: AtlasNode | null = null
  let bestDistance = Infinity
  for (const node of nodes) {
    const [sx, sy] = toScreen(camera, viewport, node.x, node.y, placement.z?.(node) ?? 0)
    const distance = Math.hypot(sx - px, sy - py)
    if (distance <= Math.max(reach, (placement.radius?.(node) ?? 0) + 4) && distance < bestDistance) {
      best = node
      bestDistance = distance
    }
  }
  return best
}

function insideRing(ring: AtlasPoint[], x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [ax, ay] = ring[i]
    const [bx, by] = ring[j]
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) hit = !hit
  }
  return hit
}

/** Is a map point inside a zone's outline? Rings use the even-odd rule, so holes are outside. */
export function insideContour(contour: AtlasContour | null, x: number, y: number): boolean {
  if (!contour) return false
  if (contour.type === 'circle') return Math.hypot(x - contour.x, y - contour.y) <= contour.radius
  return contour.rings.reduce((hit, ring) => (insideRing(ring, x, y) ? !hit : hit), false)
}

/** The zone whose outline holds a map point; the smallest wins where outlines overlap. */
export function zoneAt(zones: readonly AtlasZone[], x: number, y: number): AtlasZone | null {
  const hits = zones.filter((zone) => insideContour(zone.contour, x, y))
  return hits.sort((a, b) => a.memberCount - b.memberCount)[0] ?? null
}

/**
 * A stable hue per zone. Zones are ordered by id, so a zone keeps its colour
 * from week to week (the feature-store carries ids forward), and hues step by
 * the golden angle so neighbours in the list never share a colour.
 */
export function zoneHues(zones: readonly AtlasZone[]): Map<string, number> {
  const ids = zones.map((zone) => zone.zoneId).sort()
  return new Map(ids.map((id, index) => [id, Math.round((index * 137.508 + 18) % 360)]))
}

// ------------------------------------------------------------------ ground

/**
 * The ground as a sheet that sinks under companies many others move with
 * (their well), like mass in space-time. Sampled on a grid in map units and
 * scaled to [-1, 0]; `null` when no company carries a well (signed out).
 */
export type Sheet = { x0: number; y0: number; cell: number; columns: number; rows: number; depth: number; values: Float32Array }

/** Well width and depth as shares of the map's span, and how many of the deepest wells shape the ground. */
export const WELL_WIDTH = 0.045
export const WELL_DEPTH = 0.055
export const HEAVIEST_WELLS = 70
const SHEET_COLUMNS = 160

export function buildSheet(nodes: readonly AtlasNode[], bounds: Bounds): Sheet | null {
  const heavy = nodes
    .filter((node) => node.well !== null && node.well > 0)
    .map((node) => ({ x: node.x, y: node.y, mass: (node.well as number) ** 2 }))
    .sort((a, b) => b.mass - a.mass)
    .slice(0, HEAVIEST_WELLS)
  if (!heavy.length) return null
  const span = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0, 1e-6)
  const width = WELL_WIDTH * span
  const reach2 = (3.6 * width) ** 2
  const columns = SHEET_COLUMNS
  const cell = (bounds.x1 - bounds.x0) / columns
  const rows = Math.max(2, Math.ceil((bounds.y1 - bounds.y0) / cell))
  const values = new Float32Array(columns * rows)
  let lowest = 0
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = bounds.x0 + (column + 0.5) * cell
      const y = bounds.y0 + (row + 0.5) * cell
      let z = 0
      for (const well of heavy) {
        const d2 = (x - well.x) ** 2 + (y - well.y) ** 2
        if (d2 < reach2) z -= well.mass * Math.exp(-d2 / (2 * width * width))
      }
      values[row * columns + column] = z
      lowest = Math.min(lowest, z)
    }
  }
  if (lowest < 0) for (let k = 0; k < values.length; k += 1) values[k] /= -lowest
  return { x0: bounds.x0, y0: bounds.y0, cell, columns, rows, depth: WELL_DEPTH * span, values }
}

/** Height of the ground at a map point, in map units (0 flat, down to -depth at the deepest well). */
export function groundAt(sheet: Sheet | null, x: number, y: number): number {
  if (!sheet) return 0
  const clamp = (value: number, high: number) => Math.max(0, Math.min(high, value))
  const gx = clamp((x - sheet.x0) / sheet.cell - 0.5, sheet.columns - 1.001)
  const gy = clamp((y - sheet.y0) / sheet.cell - 0.5, sheet.rows - 1.001)
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = gx - x0
  const fy = gy - y0
  const at = (column: number, row: number) => sheet.values[Math.min(sheet.rows - 1, row) * sheet.columns + Math.min(sheet.columns - 1, column)]
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx
  return (top * (1 - fy) + bottom * fy) * sheet.depth
}

// ------------------------------------------------------------------ bundles

export type Strand = { from: AtlasPoint; to: AtlasPoint; c1: AtlasPoint; c2: AtlasPoint; correlation: number | null }

/**
 * A bundle between two regions (Holten 2006): every real tie whose two
 * companies are on the map leaves its own company, travels with the others
 * through the middle and fans out to its company at the other end. Ties with
 * a company not on the map yet are left out, never drawn from a made-up point.
 */
export function bundleStrands(
  bundle: AtlasBundle,
  positions: ReadonlyMap<string, { x: number; y: number; zoneId: string }>,
  tightness = 0.75,
): Strand[] {
  const pairs: Array<[{ x: number; y: number }, { x: number; y: number }, number | null]> = []
  for (const tie of bundle.ties) {
    const a = positions.get(tie.source)
    const b = positions.get(tie.target)
    if (!a || !b) continue
    // Orient every strand from zone A to zone B, whichever way the tie was written.
    pairs.push(a.zoneId === bundle.zoneB || b.zoneId === bundle.zoneA ? [b, a, tie.correlation] : [a, b, tie.correlation])
  }
  if (!pairs.length) return []
  const mean = (points: Array<{ x: number; y: number }>): AtlasPoint => [
    points.reduce((sum, point) => sum + point.x, 0) / points.length,
    points.reduce((sum, point) => sum + point.y, 0) / points.length,
  ]
  const ca = mean(pairs.map(([a]) => a))
  const cb = mean(pairs.map(([, b]) => b))
  const along = (t: number): AtlasPoint => [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t]
  const k1 = along(0.3)
  const k2 = along(0.7)
  return pairs.map(([a, b, correlation]) => ({
    from: [a.x, a.y],
    to: [b.x, b.y],
    c1: [a.x + (k1[0] - a.x) * tightness, a.y + (k1[1] - a.y) * tightness],
    c2: [b.x + (k2[0] - b.x) * tightness, b.y + (k2[1] - b.y) * tightness],
    correlation,
  }))
}

/** The bundles a region in focus shows, most ties first: three on hover, five when selected. */
export function focusBundles(bundles: readonly AtlasBundle[], zoneId: string, limit: number): AtlasBundle[] {
  return bundles
    .filter((bundle) => bundle.zoneA === zoneId || bundle.zoneB === zoneId)
    .sort((a, b) => b.tieCount - a.tieCount || (a.zoneA + a.zoneB).localeCompare(b.zoneA + b.zoneB))
    .slice(0, limit)
}

// ------------------------------------------------------------------ reading

export type SearchResult =
  | { kind: 'company'; symbol: string; name: string | null; zoneId: string }
  | { kind: 'zone'; zoneId: string; label: string; memberCount: number }

/** Companies and regions on the map matching a query: ticker prefix first, then names and labels. */
export function findOnMap(query: string, nodes: readonly AtlasNode[], zones: readonly AtlasZone[], limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored: Array<[number, string, SearchResult]> = []
  for (const node of nodes) {
    const symbol = node.symbol.toLowerCase()
    const name = (node.name ?? '').toLowerCase()
    const score = symbol === q ? 0 : symbol.startsWith(q) ? 1 : name.startsWith(q) ? 2 : name.includes(q) || symbol.includes(q) ? 4 : -1
    if (score >= 0) scored.push([score, node.symbol, { kind: 'company', symbol: node.symbol, name: node.name, zoneId: node.zoneId }])
  }
  for (const zone of zones) {
    const label = zone.label.toLowerCase()
    const score = label.startsWith(q) ? 2 : label.includes(q) ? 3 : -1
    if (score >= 0) scored.push([score, zone.label, { kind: 'zone', zoneId: zone.zoneId, label: zone.label, memberCount: zone.memberCount }])
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).slice(0, limit).map(([, , result]) => result)
}

/** The companies most others move with, beyond the market. Signed out nobody carries a reach, so the list is empty. */
export function mostConnected(nodes: readonly AtlasNode[], limit = 6): AtlasNode[] {
  return nodes
    .filter((node) => node.reach !== null)
    .sort((a, b) => (b.reach as number) - (a.reach as number) || a.symbol.localeCompare(b.symbol))
    .slice(0, limit)
}

/** "Average correlation 0.07 · lower for this market over the last year", or just the value before a full year. */
export function correlationSentence(value: AtlasMarketCorrelation | null): string | null {
  if (!value) return null
  const number = `Average correlation ${value.value.toFixed(2)}`
  if (!value.comparedWithLastYear) return number
  const word = value.comparedWithLastYear === 'usual' ? 'about usual' : value.comparedWithLastYear
  return `${number} · ${word} for this market over the last year`
}
