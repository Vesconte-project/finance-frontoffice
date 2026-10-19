/**
 * Canvas 2D drawing of one atlas frame, after the approved prototype (v18):
 * a ground that sinks into wells, regions as tinted areas with white borders
 * between them and a coastline around them, the strongest lines inside each
 * region, bundles of real ties between regions, shaded balls and printed-map
 * names. Everything drawn comes from the backend's answer; nothing is placed
 * where the data does not put it.
 */
import type { AtlasBundle, AtlasLine, AtlasNode, AtlasPoint, AtlasZone } from '@/lib/atlas-model'
import {
  LEVEL_ZOOM,
  ballRadius,
  bundleStrands,
  focusBundles,
  groundAt,
  toScreen,
  type Bounds,
  type Camera,
  type Sheet,
  type Viewport,
} from '@/lib/atlas-view'

export type Palette = { bg: string; surface: string; text: string; muted: string; accent: string; dark: boolean }

export type Scene = {
  viewport: Viewport
  camera: Camera
  /** Zoom against the whole-map fit. */
  zoom: number
  palette: Palette
  bounds: Bounds
  sheet: Sheet | null
  zones: AtlasZone[]
  hues: ReadonlyMap<string, number>
  nodes: AtlasNode[]
  lines: AtlasLine[]
  bundles: AtlasBundle[]
  signedIn: boolean
  /** The week's average correlation, the baseline a tie's strength is read against. */
  baseline: number
  showNames: boolean
  selectedZone: string | null
  hoverZone: string | null
  selectedSymbol: string | null
  hoverSymbol: string | null
  /** Companies tied to the one selected or under the pointer, and the lines between them. */
  related: ReadonlySet<string>
  relatedEdges: ReadonlySet<string>
}

type Rect = { x0: number; y0: number; x1: number; y1: number }

const SANS = '"IBM Plex Sans", system-ui, sans-serif'
const CIRCLE_STEPS = 72

export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** A CSS colour as RGB: hex in any of its lengths (browsers shorten `#FFFFFF` to `#fff`) or rgb(). */
export function parseColor(value: string): [number, number, number] {
  let hex = value.trim().replace('#', '')
  if (/^[0-9a-f]{3,4}$/i.test(hex)) hex = [...hex.slice(0, 3)].map((digit) => digit + digit).join('')
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  const match = value.match(/\d+(\.\d+)?/g)
  return match && match.length >= 3 ? [Number(match[0]), Number(match[1]), Number(match[2])] : [128, 128, 128]
}

const rgba = (color: string, alpha: number) => {
  const [r, g, b] = parseColor(color)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseColor(a)
  const [br, bg, bb] = parseColor(b)
  return `rgb(${Math.round(ar + (br - ar) * t)}, ${Math.round(ag + (bg - ag) * t)}, ${Math.round(ab + (bb - ab) * t)})`
}

function hslToRgb(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return `rgb(${f(0)}, ${f(8)}, ${f(4)})`
}

/** A region's colour, as rgb() so it can be mixed and given an alpha on the canvas. */
export function zoneColor(hue: number, dark: boolean): string {
  return dark ? hslToRgb(hue, 38, 62) : hslToRgb(hue, 46, 48)
}

/** A zone's outline as rings of map points; a signed-out circle becomes a polygon so both draw the same way. */
function zoneRings(zone: AtlasZone): AtlasPoint[][] {
  const contour = zone.contour
  if (!contour) return []
  if (contour.type === 'rings') return contour.rings
  return [Array.from({ length: CIRCLE_STEPS }, (_, i): AtlasPoint => {
    const angle = (i / CIRCLE_STEPS) * Math.PI * 2
    return [contour.x + Math.cos(angle) * contour.radius, contour.y + Math.sin(angle) * contour.radius]
  })]
}

let layer: HTMLCanvasElement | null = null

export function drawAtlas(context: CanvasRenderingContext2D, scene: Scene, ratio: number): void {
  const { viewport, camera, palette, sheet } = scene
  const project = (x: number, y: number, z = 0) => toScreen(camera, viewport, x, y, z)
  const ground = (x: number, y: number) => groundAt(sheet, x, y)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, viewport.width, viewport.height)

  drawGrid(context, scene, project, ground)
  drawTerritories(context, scene, project, ground, ratio)

  const shown = new Map(scene.nodes.map((node) => [node.symbol, node]))
  const focusing = scene.selectedSymbol !== null || scene.hoverSymbol !== null
  const focusZone = scene.selectedZone ?? scene.hoverZone

  // lines: the strongest ties inside each region, for the level on screen
  context.lineCap = 'round'
  for (const line of scene.lines) {
    const a = shown.get(line.source)
    const b = shown.get(line.target)
    if (!a || !b) continue
    const strength = line.correlation === null ? 0.5 : Math.max(0, Math.min(1, line.correlation))
    const isRelated = scene.relatedEdges.has(edgeKey(line.source, line.target))
    let alpha = 0.22 * (0.4 + strength * 0.6)
    let color = palette.muted
    let width = 0.8
    if (focusing) {
      if (isRelated) {
        alpha = 0.85
        color = palette.accent
        width = 1.6
      } else alpha *= 0.2
    } else if (scene.selectedZone !== null && line.zoneId !== scene.selectedZone) alpha *= 0.25
    const [ax, ay] = project(a.x, a.y, ground(a.x, a.y))
    const [bx, by] = project(b.x, b.y, ground(b.x, b.y))
    context.beginPath()
    context.moveTo(ax, ay)
    context.lineTo(bx, by)
    context.strokeStyle = rgba(color, alpha)
    context.lineWidth = width
    context.stroke()
  }

  const pills = scene.selectedSymbol === null ? drawBundles(context, scene, project, ground, shown, focusZone) : []
  if (focusing) drawRelatedTies(context, scene, project, ground, shown)
  const placed = drawBalls(context, scene, project, ground)
  drawPills(context, scene, pills, placed)
}

function drawGrid(
  context: CanvasRenderingContext2D,
  scene: Scene,
  project: (x: number, y: number, z?: number) => AtlasPoint,
  ground: (x: number, y: number) => number,
) {
  // A light grid on the ground that bends into the wells; flat when the map has none.
  const { camera, bounds, palette } = scene
  const raw = 44 / camera.k
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * power).find((value) => value >= raw) ?? raw
  // Flat ground needs only the ends of each line; a sheet with wells is sampled along it.
  const samples = (from: number, to: number) => {
    const every = scene.sheet ? step / 6 : to - from
    const values: number[] = []
    for (let value = from; value < to; value += every) values.push(value)
    values.push(to)
    return values
  }
  context.beginPath()
  for (let x = Math.ceil(bounds.x0 / step) * step; x <= bounds.x1; x += step) {
    samples(bounds.y0, bounds.y1).forEach((y, index) => {
      const [px, py] = project(x, y, ground(x, y))
      if (index === 0) context.moveTo(px, py)
      else context.lineTo(px, py)
    })
  }
  for (let y = Math.ceil(bounds.y0 / step) * step; y <= bounds.y1; y += step) {
    samples(bounds.x0, bounds.x1).forEach((x, index) => {
      const [px, py] = project(x, y, ground(x, y))
      if (index === 0) context.moveTo(px, py)
      else context.lineTo(px, py)
    })
  }
  context.strokeStyle = rgba(palette.muted, palette.dark ? 0.16 : 0.13)
  context.lineWidth = 0.8
  context.stroke()
}

function drawTerritories(
  context: CanvasRenderingContext2D,
  scene: Scene,
  project: (x: number, y: number, z?: number) => AtlasPoint,
  ground: (x: number, y: number) => number,
  ratio: number,
) {
  const { viewport, palette } = scene
  layer ??= document.createElement('canvas')
  const width = Math.round(viewport.width * ratio)
  const height = Math.round(viewport.height * ratio)
  if (layer.width !== width || layer.height !== height) {
    layer.width = width
    layer.height = height
  }
  const paint = layer.getContext('2d')
  if (!paint) return
  paint.setTransform(ratio, 0, 0, ratio, 0, 0)
  paint.clearRect(0, 0, viewport.width, viewport.height)
  paint.lineJoin = 'round'
  paint.lineCap = 'round'
  const focus = scene.selectedZone ?? scene.hoverZone
  // A selected region stands out more than one under the pointer.
  const lift = scene.selectedZone !== null ? 1.8 : 1.4
  const emphasis = (zoneId: string) => (focus === null ? 1 : zoneId === focus ? lift : 0.32)
  const paths = new Map<string, Path2D>()
  for (const zone of scene.zones) {
    const path = new Path2D()
    for (const ring of zoneRings(zone)) {
      ring.forEach(([x, y], index) => {
        const [px, py] = project(x, y, ground(x, y))
        if (index === 0) path.moveTo(px, py)
        else path.lineTo(px, py)
      })
      path.closePath()
    }
    paths.set(zone.zoneId, path)
  }
  // 1. the regions, tinted; colours are mixed with the paper so an overlap reads as both
  for (const zone of scene.zones) {
    const path = paths.get(zone.zoneId)
    if (!path) continue
    paint.fillStyle = rgba(zoneColor(scene.hues.get(zone.zoneId) ?? 200, palette.dark), (palette.dark ? 0.2 : 0.17) * 1.35 * emphasis(zone.zoneId))
    paint.fill(path, 'evenodd')
  }
  // 2. borders in the paper's colour, only where they cross a tinted area
  paint.globalCompositeOperation = 'source-atop'
  paint.strokeStyle = rgba(palette.bg, 0.95)
  paint.lineWidth = 2.6
  for (const path of paths.values()) paint.stroke(path)
  // 3. the coastline, only outside every region
  paint.globalCompositeOperation = 'destination-over'
  paint.strokeStyle = rgba(palette.muted, 0.45)
  paint.lineWidth = 1.1
  for (const zone of scene.zones) {
    const path = paths.get(zone.zoneId)
    if (!path) continue
    paint.setLineDash(zone.contour?.type === 'circle' ? [3, 4] : [])
    paint.stroke(path)
  }
  paint.setLineDash([])
  paint.globalCompositeOperation = 'source-over'
  // 4. the region in focus, outlined
  const focused = focus !== null ? paths.get(focus) : undefined
  if (focused) {
    paint.strokeStyle = rgba(mix(zoneColor(scene.hues.get(focus as string) ?? 200, palette.dark), palette.dark ? '#ffffff' : '#000000', 0.2), 0.95)
    paint.lineWidth = 2
    paint.stroke(focused)
  }
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.globalAlpha = scene.selectedSymbol !== null ? 0.55 : 1
  context.drawImage(layer, 0, 0)
  context.restore()
}

type Pill = { at: AtlasPoint; text: string }

function drawBundles(
  context: CanvasRenderingContext2D,
  scene: Scene,
  project: (x: number, y: number, z?: number) => AtlasPoint,
  ground: (x: number, y: number) => number,
  shown: ReadonlyMap<string, AtlasNode>,
  focusZone: string | null,
): Pill[] {
  const { palette, viewport } = scene
  const zonesById = new Map(scene.zones.map((zone) => [zone.zoneId, zone]))
  const picked = scene.selectedZone !== null
  const involved = new Set(focusZone ? focusBundles(scene.bundles, focusZone, picked ? 5 : 3) : [])
  const pills: Pill[] = []
  const onScreen = ([x, y]: AtlasPoint) => x > 60 && x < viewport.width - 70 && y > 70 && y < viewport.height - 60
  const anchorOf = (zoneId: string): AtlasPoint | null => {
    const zone = zonesById.get(zoneId)
    return zone && zone.x !== null && zone.y !== null ? [zone.x, zone.y] : null
  }
  const otherOf = (bundle: AtlasBundle) => (bundle.zoneA === focusZone ? bundle.zoneB : bundle.zoneA)

  if (!scene.signedIn) {
    // Signed out: how many ties join a region in focus to its closest regions, never the ties themselves.
    for (const bundle of involved) {
      const near = anchorOf(focusZone as string)
      const other = otherOf(bundle)
      const far = anchorOf(other)
      if (!near || !far) continue
      const [ax, ay] = project(near[0], near[1])
      const [bx, by] = project(far[0], far[1])
      context.setLineDash([4, 5])
      context.beginPath()
      context.moveTo(ax, ay)
      context.lineTo(bx, by)
      context.strokeStyle = rgba(palette.accent, 0.6)
      context.lineWidth = 1.4
      context.stroke()
      context.setLineDash([])
      pills.push({ at: [ax + (bx - ax) * 0.7, ay + (by - ay) * 0.7], text: `${zonesById.get(other)?.label ?? other} · ${bundle.tieCount} ties` })
    }
    return pills
  }

  const positions = new Map([...shown.values()].map((node) => [node.symbol, node]))
  const focusMax = Math.max(1, ...[...involved].map((bundle) => bundle.tieCount))
  const keepMax = Math.max(1, ...scene.bundles.filter((bundle) => bundle.structural).map((bundle) => bundle.tieCount))
  context.lineCap = 'round'
  for (const bundle of scene.bundles) {
    const isInvolved = involved.has(bundle)
    if (focusZone !== null && (bundle.zoneA === focusZone || bundle.zoneB === focusZone) && !isInvolved) continue
    if (!bundle.structural && !isInvolved) continue
    if (picked && !isInvolved) continue
    // More strands for more ties, so a thicker bundle really means more ties.
    const count = isInvolved ? Math.max(3, Math.round((40 * bundle.tieCount) / focusMax)) : Math.max(2, Math.round((12 * bundle.tieCount) / keepMax))
    const strands = bundleStrands({ ...bundle, ties: bundle.ties.slice(0, count) }, positions, isInvolved ? 0.88 : 0.75)
    const alpha = isInvolved ? 0.5 : focusZone !== null ? 0.07 : 0.2
    for (const strand of strands) {
      const strength = Math.max(0.15, Math.min(1, ((strand.correlation ?? scene.baseline + 0.25) - scene.baseline) / 0.5))
      const [ax, ay] = project(strand.from[0], strand.from[1], ground(strand.from[0], strand.from[1]))
      const [bx, by] = project(strand.to[0], strand.to[1], ground(strand.to[0], strand.to[1]))
      const [c1x, c1y] = project(strand.c1[0], strand.c1[1])
      const [c2x, c2y] = project(strand.c2[0], strand.c2[1])
      context.beginPath()
      context.moveTo(ax, ay)
      context.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by)
      context.strokeStyle = rgba(isInvolved ? palette.accent : palette.text, alpha * (0.35 + 0.65 * strength))
      context.lineWidth = (isInvolved ? 0.6 : 0.4) + 1.6 * strength
      context.stroke()
    }
    if (isInvolved) {
      // The count, where the bundle reaches the other region; with its name when that region is off screen.
      const other = otherOf(bundle)
      const near = anchorOf(focusZone as string)
      const far = anchorOf(other)
      if (!near || !far) continue
      const at = (t: number) => project(near[0] + (far[0] - near[0]) * t, near[1] + (far[1] - near[1]) * t)
      let t = 0.82
      let point = at(t)
      while (!onScreen(point) && t > 0.2) {
        t -= 0.04
        point = at(t)
      }
      const seen = onScreen(project(far[0], far[1]))
      pills.push({ at: point, text: seen ? `${bundle.tieCount} ties` : `${zonesById.get(other)?.label ?? other} · ${bundle.tieCount} ties` })
    }
  }
  return pills
}

function drawRelatedTies(
  context: CanvasRenderingContext2D,
  scene: Scene,
  project: (x: number, y: number, z?: number) => AtlasPoint,
  ground: (x: number, y: number) => number,
  shown: ReadonlyMap<string, AtlasNode>,
) {
  // The company in focus: straight lines to every tie of it on the map that the lines above did not draw.
  const center = shown.get(scene.selectedSymbol ?? scene.hoverSymbol ?? '')
  if (!center) return
  const drawn = new Set(scene.lines.map((line) => edgeKey(line.source, line.target)))
  const [cx, cy] = project(center.x, center.y, ground(center.x, center.y))
  for (const symbol of scene.related) {
    if (symbol === center.symbol || drawn.has(edgeKey(symbol, center.symbol))) continue
    const other = shown.get(symbol)
    if (!other) continue
    const [ox, oy] = project(other.x, other.y, ground(other.x, other.y))
    context.beginPath()
    context.moveTo(cx, cy)
    context.lineTo(ox, oy)
    context.strokeStyle = rgba(scene.palette.accent, 0.7)
    context.lineWidth = 1.3
    context.stroke()
  }
}

function drawBalls(
  context: CanvasRenderingContext2D,
  scene: Scene,
  project: (x: number, y: number, z?: number) => AtlasPoint,
  ground: (x: number, y: number) => number,
): Rect[] {
  const { palette, camera, viewport, zoom } = scene
  const focusing = scene.selectedSymbol !== null || scene.hoverSymbol !== null
  const node = mix(palette.muted, palette.bg, palette.dark ? 0.1 : 0.12)
  const sin = Math.sin(camera.pitch)
  const placedBalls = new Map<string, { x: number; y: number; r: number; alpha: number }>()
  // back to front: in a tilted view, farther rows (larger y) first
  const order = [...scene.nodes].sort((a, b) => (sin > 0 ? b.y - a.y : 0) || b.size - a.size)
  for (const item of order) {
    const r = Math.max(1.4, ballRadius(item.size, zoom))
    const z = ground(item.x, item.y)
    const [gx, gy] = project(item.x, item.y, z)
    // the ball rests in the ground, its centre one radius up
    const [x, y] = [gx, gy - r * sin]
    if (x < -30 || y < -30 || x > viewport.width + 30 || y > viewport.height + 30) continue
    const dimmed = focusing
      ? !scene.related.has(item.symbol) && item.symbol !== scene.selectedSymbol && item.symbol !== scene.hoverSymbol
      : scene.selectedZone !== null && item.zoneId !== scene.selectedZone
    const alpha = dimmed ? 0.22 : 1
    placedBalls.set(item.symbol, { x, y, r, alpha })
    if (sin > 0) {
      context.beginPath()
      context.ellipse(gx, gy, r * 0.95, r * 0.95 * Math.max(0.25, Math.cos(camera.pitch)), 0, 0, Math.PI * 2)
      context.fillStyle = `rgba(0, 0, 0, ${(palette.dark ? 0.28 : 0.12) * alpha})`
      context.fill()
    }
    const selected = item.symbol === scene.selectedSymbol
    const base = selected ? palette.accent : item.symbol === scene.hoverSymbol ? mix(node, palette.text, 0.35) : node
    if (item.loner && !selected) {
      context.beginPath()
      context.arc(x, y, r * 0.85, 0, Math.PI * 2)
      context.fillStyle = rgba(palette.surface, 0.9 * alpha)
      context.fill()
      context.setLineDash([2, 2])
      context.lineWidth = 1.4
      context.strokeStyle = rgba(node, alpha)
      context.stroke()
      context.setLineDash([])
    } else {
      const shade = context.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
      shade.addColorStop(0, rgba(mix(base, '#ffffff', palette.dark ? 0.25 : 0.45), alpha))
      shade.addColorStop(0.6, rgba(base, alpha))
      shade.addColorStop(1, rgba(mix(base, '#000000', 0.28), alpha))
      context.beginPath()
      context.arc(x, y, r, 0, Math.PI * 2)
      context.fillStyle = shade
      context.fill()
    }
    if (selected) {
      context.lineWidth = 2
      context.strokeStyle = rgba(palette.accent, 0.9)
      context.beginPath()
      context.arc(x, y, Math.max(r + 3, 6), 0, Math.PI * 2)
      context.stroke()
    }
  }
  return drawLabels(context, scene, project, ground, placedBalls)
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
}

function drawLabels(
  context: CanvasRenderingContext2D,
  scene: Scene,
  project: (x: number, y: number, z?: number) => AtlasPoint,
  ground: (x: number, y: number) => number,
  balls: ReadonlyMap<string, { x: number; y: number; r: number; alpha: number }>,
): Rect[] {
  const { palette, viewport, zoom } = scene
  const placed: Rect[] = []
  const halo = (text: string, x: number, y: number, fill: string, alpha: number) => {
    context.lineJoin = 'round'
    context.lineWidth = 3.5
    context.strokeStyle = rgba(palette.bg, 0.92 * alpha)
    context.strokeText(text, x, y)
    context.fillStyle = fill
    context.fillText(text, x, y)
  }
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const focusing = scene.selectedSymbol !== null
  // Region names: printed-map capitals, larger for larger regions; they step back once a single region fills the view.
  if (scene.showNames && zoom < LEVEL_ZOOM[3] + 2) {
    const zones = [...scene.zones].sort((a, b) => Number(b.zoneId === scene.selectedZone) - Number(a.zoneId === scene.selectedZone) || b.memberCount - a.memberCount)
    for (const zone of zones) {
      if (zone.x === null || zone.y === null) continue
      const [x, y] = project(zone.x, zone.y, ground(zone.x, zone.y))
      const size = zone.memberCount >= 40 ? 13 : 11
      context.font = `600 ${size}px ${SANS}`
      context.letterSpacing = '0.08em'
      const text = zone.label.replace(/_/g, ' ').toUpperCase()
      const width = context.measureText(text).width + 10
      const rect = { x0: x - width / 2, x1: x + width / 2, y0: y - (size + 8) / 2, y1: y + (size + 8) / 2 }
      if (rect.x0 < 4 || rect.x1 > viewport.width - 4 || rect.y0 < 4 || rect.y1 > viewport.height - 8 || placed.some((other) => overlaps(other, rect))) {
        context.letterSpacing = '0px'
        continue
      }
      placed.push(rect)
      const dim = (scene.selectedZone !== null && scene.selectedZone !== zone.zoneId) || focusing
      const alpha = dim ? 0.4 : 1
      const ink = mix(zoneColor(scene.hues.get(zone.zoneId) ?? 200, palette.dark), palette.dark ? '#ebebeb' : '#141414', palette.dark ? 0.35 : 0.45)
      halo(text, x, y, rgba(ink, alpha), alpha)
      context.letterSpacing = '0px'
    }
  }
  // Company names: the selected one and its ties first, then the larger balls.
  const candidates = [...balls.entries()].filter(([symbol, ball]) =>
    ball.alpha > 0.5 && (ball.r >= 6.5 || scene.related.has(symbol) || symbol === scene.selectedSymbol) &&
    (scene.showNames || symbol === scene.selectedSymbol || scene.related.has(symbol)))
  candidates.sort(([a, ballA], [b, ballB]) =>
    Number(b === scene.selectedSymbol) - Number(a === scene.selectedSymbol) ||
    Number(scene.related.has(b)) - Number(scene.related.has(a)) || ballB.r - ballA.r)
  for (const [symbol, ball] of candidates) {
    const size = ball.r > 15 ? 12 : 11
    context.font = `500 ${size}px ${SANS}`
    const width = context.measureText(symbol).width + 6
    const y = ball.y + ball.r + size * 0.8
    const rect = { x0: ball.x - width / 2, x1: ball.x + width / 2, y0: y - size * 0.62, y1: y + size * 0.62 }
    if (placed.some((other) => overlaps(other, rect)) || rect.x0 < 4 || rect.x1 > viewport.width - 4 || rect.y1 > viewport.height - 4) continue
    placed.push(rect)
    const selected = symbol === scene.selectedSymbol
    const alpha = selected ? 1 : 0.84
    halo(symbol, ball.x, y, selected ? rgba(palette.accent, 1) : rgba(palette.text, alpha), alpha)
  }
  return placed
}

function drawPills(context: CanvasRenderingContext2D, scene: Scene, pills: Pill[], placed: Rect[]) {
  // Counts sit around the names, never on them; one with no room is left out.
  const { palette } = scene
  context.font = `500 11px ${SANS}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const { at: [x, y], text } of pills) {
    const width = context.measureText(text).width + 12
    for (const dy of [0, -24, 24, -48, 48]) {
      const rect = { x0: x - width / 2, x1: x + width / 2, y0: y + dy - 10, y1: y + dy + 10 }
      if (placed.some((other) => overlaps(other, rect))) continue
      placed.push(rect)
      context.beginPath()
      context.roundRect(rect.x0, rect.y0, width, 20, 10)
      context.fillStyle = rgba(palette.surface, 0.86)
      context.fill()
      context.strokeStyle = rgba(palette.muted, 0.22)
      context.lineWidth = 1
      context.stroke()
      context.fillStyle = rgba(palette.accent, 1)
      context.fillText(text, x, y + dy)
      break
    }
  }
}
