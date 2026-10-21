/**
 * Pure geometry for drawing the atlas: the camera, the zoom-to-level rule,
 * hit testing and zone colours. No DOM, so it is unit-tested directly.
 */
import type { AtlasContour, AtlasNode, AtlasOverview, AtlasPoint, AtlasZone } from './atlas-model'

export type Bounds = { x0: number; y0: number; x1: number; y1: number }
export type Camera = { cx: number; cy: number; k: number }
export type Viewport = { width: number; height: number }

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

/** The camera that shows `bounds` whole inside the viewport. */
export function fitCamera(bounds: Bounds, viewport: Viewport): Camera {
  const width = Math.max(1e-6, bounds.x1 - bounds.x0)
  const height = Math.max(1e-6, bounds.y1 - bounds.y0)
  const k = Math.min(viewport.width / width, viewport.height / height)
  return { cx: (bounds.x0 + bounds.x1) / 2, cy: (bounds.y0 + bounds.y1) / 2, k: Number.isFinite(k) && k > 0 ? k : 1 }
}

/** Map units to CSS pixels. North is up: a larger y is higher on screen. */
export function toScreen(camera: Camera, viewport: Viewport, x: number, y: number): AtlasPoint {
  return [viewport.width / 2 + (x - camera.cx) * camera.k, viewport.height / 2 - (y - camera.cy) * camera.k]
}

export function toWorld(camera: Camera, viewport: Viewport, px: number, py: number): AtlasPoint {
  return [camera.cx + (px - viewport.width / 2) / camera.k, camera.cy - (py - viewport.height / 2) / camera.k]
}

/** Zoom by `factor` keeping the point under (px, py) still, within the allowed range of the fit. */
export function zoomAt(camera: Camera, viewport: Viewport, fitK: number, factor: number, px: number, py: number): Camera {
  const k = Math.max(fitK * MIN_ZOOM, Math.min(fitK * MAX_ZOOM, camera.k * factor))
  const [wx, wy] = toWorld(camera, viewport, px, py)
  return { k, cx: wx - (px - viewport.width / 2) / k, cy: wy + (py - viewport.height / 2) / k }
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

/** Dot radius in CSS pixels for a size step (0 is the largest). */
export function dotRadius(size: number): number {
  return [5.5, 4.2, 3.2, 2.4][Math.max(0, Math.min(3, Math.round(size)))]
}

/** The company under a pointer, if any is within reach. */
export function nodeAt(
  nodes: readonly AtlasNode[],
  camera: Camera,
  viewport: Viewport,
  px: number,
  py: number,
  reach = 10,
): AtlasNode | null {
  let best: AtlasNode | null = null
  let bestDistance = Infinity
  for (const node of nodes) {
    const [sx, sy] = toScreen(camera, viewport, node.x, node.y)
    const distance = Math.hypot(sx - px, sy - py)
    if (distance <= Math.max(reach, dotRadius(node.size) + 4) && distance < bestDistance) {
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
