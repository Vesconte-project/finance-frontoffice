/*
 * The flight from the homepage to a ticker page: the camera turns the
 * homepage's universe until one of its nodes lands on the ticker's identity
 * node. It starts the moment the reader chooses a ticker, on an overlay above
 * the homepage, so the page loading behind it costs no stillness; the ticker
 * page adopts the flight where it has got to (TickerUniverse) and finishes it
 * behind its own content.
 */

import {
  ensureOwnLinks,
  projectUniverse,
  type ProjectedNode,
  type Universe,
  type UniverseHandoff,
  type UniverseView,
} from './ticker-universe'

export const ARRIVAL_MS = 1400
export const REST_PITCH = 0.16
// Close enough that the universe always reaches past the band's edges: the
// reader never sees where it ends.
export const REST_ZOOM = 1.6
// The camera turns by at most this much on the way, and at least the minimum,
// so the world visibly moves without ever swinging away from the node.
const MAX_TURN = 0.7
const MIN_TURN = 0.25
// Below the identity band the universe is gone; it starts to fade at this
// fraction of the band's height.
const FADE_FROM = 0.4
const ABANDON_MS = 12_000

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k

export type Palette = { accent: string; line: string; bg: string; surface: string; muted: string; text: string }

/** 'r,g,b' for any CSS colour the canvas understands. */
export function rgbOf(g: CanvasRenderingContext2D, value: string) {
  const probe = g.fillStyle
  g.fillStyle = value
  const normalised = String(g.fillStyle)
  g.fillStyle = probe
  if (normalised.startsWith('#')) return [1, 3, 5].map((o) => Number.parseInt(normalised.slice(o, o + 2), 16)).join(',')
  return normalised.replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).map((v) => v.trim()).join(',')
}

export function readPalette(g: CanvasRenderingContext2D): Palette {
  const theme = getComputedStyle(document.documentElement)
  const token = (name: string) => theme.getPropertyValue(name).trim()
  return {
    accent: rgbOf(g, token('--accent')),
    line: rgbOf(g, token('--network-node')),
    bg: token('--bg'),
    surface: token('--surface'),
    muted: token('--text-muted'),
    text: token('--text'),
  }
}

export type CameraPlan = { start: Omit<UniverseView, 'x' | 'y'>; end: Omit<UniverseView, 'x' | 'y'> }

/**
 * Where the camera rests: facing the universe with the node towards its left
 * edge, so the rest of the world spreads out to the right. Arriving from the
 * homepage, it gets there by a short turn from the homepage's camera.
 */
export function planCamera(universe: Universe, from: UniverseView | null): CameraPlan {
  const fn = universe.nodes[universe.focus]
  const facing = Math.atan2(fn.z, -fn.x)
  if (!from) {
    const rest = { ax: REST_PITCH, ay: facing, zoom: REST_ZOOM }
    return { start: rest, end: rest }
  }
  let delta = (facing - from.ay) % (2 * Math.PI)
  if (delta > Math.PI) delta -= 2 * Math.PI
  if (delta < -Math.PI) delta += 2 * Math.PI
  const turn = Math.sign(delta || 1) * Math.min(MAX_TURN, Math.max(MIN_TURN, Math.abs(delta)))
  return {
    start: { ax: from.ax, ay: from.ay, zoom: from.zoom },
    end: { ax: REST_PITCH, ay: from.ay + turn, zoom: REST_ZOOM },
  }
}

export function viewAt(plan: CameraPlan, k: number, idle: number, x: number, y: number): UniverseView {
  return {
    ax: lerp(plan.start.ax, plan.end.ax, k),
    ay: lerp(plan.start.ay, plan.end.ay, k) + idle,
    zoom: lerp(plan.start.zoom, plan.end.zoom, k),
    x,
    y,
  }
}

type FrameInput = {
  universe: Universe
  handoff: UniverseHandoff | null
  ownLinksFrom: number
  projected: ProjectedNode[]
  k: number
  done: boolean
  width: number
  height: number
  bandBottom: number
  palette: Palette
}

/**
 * One frame of the universe: the homepage's look at k = 0, easing into the
 * faint band at k = 1. Returns the veil still over the field and how much of
 * the homepage's labelling remains, for the orb drawn above it.
 */
export function drawUniverseFrame(g: CanvasRenderingContext2D, input: FrameInput) {
  const { universe, handoff, ownLinksFrom, projected, k, done, width, height, bandBottom, palette } = input
  const { nodes, pairs, pairLengths, lightReach, focus } = universe
  const { accent, line, bg, muted } = palette
  const lineScale = lerp(handoff?.lineScale ?? 1, 1, k)
  const progress = handoff?.progress ?? 0

  // Links: the homepage's look, easing into a faint band.
  for (let p = 0; p < pairs.length; p += 2) {
    const ia = pairs[p], ib = pairs[p + 1]
    if (ia === focus || ib === focus) continue
    const a = nodes[ia], b = nodes[ib], pa = projected[ia], pb = projected[ib]
    const depth = Math.min(pa.depth, pb.depth)
    const clar = Math.min(a.clar, b.clar)
    const homeAlpha = (0.03 + 0.11 * depth + 0.05 * progress) * (0.06 + 0.94 * clar)
    const restAlpha = 0.02 + 0.06 * depth
    g.strokeStyle = 'rgba(' + line + ',' + lerp(homeAlpha, restAlpha, k) + ')'
    g.lineWidth = lineScale
    g.beginPath(); g.moveTo(pa.sx, pa.sy); g.lineTo(pb.sx, pb.sy); g.stroke()
    const peak = Math.max(a.light, b.light)
    if (peak > 0.08) {
      const length = pairLengths[p / 2]
      const strength = lerp(0.85 * (0.06 + 0.94 * clar), 0.16, k)
      const gradient = g.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy)
      for (const s of [0, 0.25, 0.5, 0.75, 1]) {
        const along = Math.max(a.light * Math.exp(-s * length / lightReach), b.light * Math.exp(-(1 - s) * length / lightReach))
        gradient.addColorStop(s, 'rgba(' + accent + ',' + Math.max(0, (along - 0.08) / 0.92) * strength + ')')
      }
      g.strokeStyle = gradient
      g.lineWidth = (1 + 0.9 * peak) * lineScale
      g.beginPath(); g.moveTo(pa.sx, pa.sy); g.lineTo(pb.sx, pb.sy); g.stroke()
    }
  }
  // Nodes. Labels belong to the homepage and leave with it.
  const labels = 1 - Math.min(1, k / 0.35)
  for (let i = 0; i < nodes.length; i++) {
    if (i === focus) continue
    const n = nodes[i], pn = projected[i]
    const homeAlpha = pn.depth * (0.10 + 0.90 * n.clar)
    const restAlpha = n.signal ? 0.3 : 0.14 + 0.26 * pn.depth
    const r = Math.min(15 * lineScale, Math.max(0.5, n.r * pn.s))
    g.globalAlpha = Math.min(1, lerp(homeAlpha, restAlpha, k))
    g.fillStyle = n.signal ? 'rgb(' + accent + ')' : 'rgb(' + line + ')'
    g.beginPath(); g.arc(pn.sx, pn.sy, r, 0, 6.283); g.fill()
    if (labels > 0 && n.label && pn.depth > 0.4) {
      g.globalAlpha = labels
      g.font = (n.signal ? '600 ' : '500 ') + Math.round((n.signal ? 12 : 11) * lineScale) + 'px "IBM Plex Mono", monospace'
      g.fillStyle = n.signal ? 'rgb(' + accent + ')' : muted
      g.fillText(n.label, pn.sx + r + 4 * lineScale, pn.sy + 3 * lineScale)
    }
  }
  g.globalAlpha = 1

  // The band keeps the universe; below it, it is gone.
  g.globalCompositeOperation = 'destination-in'
  const mask = g.createLinearGradient(0, 0, 0, height)
  const fadeFrom = Math.min(0.999, (bandBottom * FADE_FROM) / height)
  const fadeTo = Math.min(1, Math.max(fadeFrom + 0.001, bandBottom / height))
  mask.addColorStop(0, 'rgba(0,0,0,1)')
  mask.addColorStop(fadeFrom, 'rgba(0,0,0,1)')
  mask.addColorStop(fadeTo, 'rgba(0,0,0,' + (1 - k) + ')')
  mask.addColorStop(1, 'rgba(0,0,0,' + (1 - k) + ')')
  g.fillStyle = mask
  g.fillRect(0, 0, width, height)
  // ...and it spreads across the whole band, a little stronger around the
  // ticker's own node.
  const f = projected[focus]
  const reach = Math.max(width - f.sx, f.sx) * 1.1
  const around = g.createRadialGradient(f.sx, f.sy, 0, f.sx, f.sy, Math.max(1, reach))
  around.addColorStop(0, 'rgba(0,0,0,1)')
  around.addColorStop(0.35, 'rgba(0,0,0,1)')
  around.addColorStop(1, 'rgba(0,0,0,' + lerp(1, 0.55, k) + ')')
  g.fillStyle = around
  g.fillRect(0, 0, width, height)
  g.globalCompositeOperation = 'source-over'

  // The ticker's own links leave the node in the accent, fading outward.
  // A searched node's links start plain and light up on the way.
  const litLinks = handoff ? handoff.focusLinks : 1
  for (let p = 0; p < pairs.length; p += 2) {
    if (pairs[p] !== focus && pairs[p + 1] !== focus) continue
    const o = projected[pairs[p] === focus ? pairs[p + 1] : pairs[p]]
    const gained = p >= ownLinksFrom && handoff && !done ? k : 1
    const gradient = g.createLinearGradient(f.sx, f.sy, o.sx, o.sy)
    gradient.addColorStop(0, 'rgba(' + accent + ',' + lerp(0.82 * litLinks, 0.34, k) * gained + ')')
    gradient.addColorStop(1, 'rgba(' + accent + ',' + lerp(0.82 * litLinks, 0.04, k) * gained + ')')
    g.strokeStyle = gradient
    g.lineWidth = lerp(1 + 2.4 * litLinks, 1.2, k)
    g.beginPath(); g.moveTo(f.sx, f.sy); g.lineTo(o.sx, o.sy); g.stroke()
  }

  // The homepage's focus mode veils its field (#hc-focusDim); the veil lifts
  // as the camera turns, so the first frame matches the homepage's last.
  const veil = handoff && !done ? handoff.veil * (1 - k) : 0
  if (veil > 0) {
    g.globalAlpha = veil; g.fillStyle = bg
    g.fillRect(0, 0, width, height); g.globalAlpha = 1
  }
  return { veil, labels }
}

/** The identity node the flight lands on, as the ticker page draws it. */
export type RestNode = { x: number; y: number; bandBottom: number; outer: number; ring: number; tone: string }

/** The flying node: the homepage's orb or plain node, becoming the identity node. */
export function placeOrb(
  orb: HTMLElement,
  label: HTMLElement,
  input: { handoff: UniverseHandoff; k: number; x: number; y: number; rest: RestNode; palette: Palette; veil: number; labels: number },
) {
  const { handoff, k, x, y, rest, palette, veil, labels } = input
  const from = handoff.orb
  // A searched node starts as the plain node it was; the focus card's orb
  // starts in the accent.
  const startTone = from.label ? palette.accent : palette.line
  const toneMix = startTone.split(',').map((v, j) => Math.round(lerp(Number(v), Number(rest.tone.split(',')[j]), k))).join(',')
  const outer = lerp(from.outer, rest.outer, k)
  Object.assign(orb.style, {
    left: x - outer + 'px', top: y - outer + 'px',
    width: outer * 2 + 'px', height: outer * 2 + 'px',
    borderWidth: Math.min(outer, lerp(from.ring, rest.ring, k)) + 'px', borderColor: 'rgb(' + toneMix + ')',
    background: k < 0.5 ? palette.surface : palette.bg,
    boxShadow: from.glow > 0 ? '0 0 0 ' + Math.max(0, from.glow * (1 - 0.6 * k) - outer) + 'px rgba(' + palette.accent + ',' + 0.28 * (1 - k) + ')' : 'none',
    opacity: String(1 - veil),
  })
  label.style.opacity = String(from.label ? labels : 0)
}

// Where the identity node was last seen, so the flight can aim for it before
// the ticker page exists. Measured by the ticker page at rest, per width.
const REST_KEY = 'vesconte.ticker-identity-node'

export function rememberRest(rest: RestNode) {
  try {
    window.localStorage.setItem(REST_KEY, JSON.stringify({ width: document.documentElement.clientWidth, ...rest }))
  } catch {
    // A private window or blocked storage: the estimate below stands in.
  }
}

function predictedRest(palette: Palette): RestNode {
  const width = document.documentElement.clientWidth
  try {
    const saved = JSON.parse(window.localStorage.getItem(REST_KEY) ?? 'null') as (RestNode & { width: number }) | null
    if (saved && saved.width === width && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return { ...saved, tone: palette.accent }
  } catch {
    // Fall through to the estimate.
  }
  // The identity band's geometry (StockTickerLayout, StockTickerChrome,
  // StockTickerIdentity): a 1400px column with 24px gutters (20px on phones).
  const gutter = width < 768 ? 20 : 24
  const column = Math.max(0, (width - Math.min(width, 1400)) / 2)
  return { x: column + gutter + 15.5, y: 117, bandBottom: 210, outer: 8.5, ring: 2, tone: palette.accent }
}

export type Flight = {
  ticker: string
  handoff: UniverseHandoff
  universe: Universe
  ownLinksFrom: number
  plan: CameraPlan
  startedAt: number
  orb: HTMLSpanElement
  orbLabel: HTMLSpanElement
}

type Overlay = { canvas: HTMLCanvasElement; rafId: number; abandon: number }

let current: { flight: Flight; overlay: Overlay | null; release: number } | null = null

function discard() {
  if (!current) return
  const { flight, overlay, release } = current
  if (overlay) { cancelAnimationFrame(overlay.rafId); window.clearTimeout(overlay.abandon); overlay.canvas.remove() }
  window.clearTimeout(release)
  flight.orb.remove()
  current = null
}

// The homepage registers itself while it is mounted, so a search made from
// it can carry its network too (see TickerSearchCombobox).
let provider: ((ticker: string) => UniverseHandoff | null) | null = null

export function provideUniverse(make: (ticker: string) => UniverseHandoff | null) {
  provider = make
  return () => { if (provider === make) provider = null }
}

/** Starts the flight to `ticker` from the mounted homepage, if there is one. */
export function flyToTicker(ticker: string) {
  const handoff = provider?.(ticker.trim().toUpperCase())
  if (handoff) startFlight(handoff)
}

/** Starts the flight now, over the homepage (styled in app/globals.css). */
export function startFlight(handoff: UniverseHandoff) {
  discard()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.className = 'universe-flight'
  canvas.setAttribute('aria-hidden', 'true')
  const g = canvas.getContext('2d')
  if (!g) return
  const orb = document.createElement('span')
  orb.className = 'universe-flight__orb'
  orb.setAttribute('aria-hidden', 'true')
  const orbLabel = document.createElement('span')
  orbLabel.className = 'universe-flight__label'
  orbLabel.textContent = handoff.ticker
  orb.append(orbLabel)

  const universe = handoff.universe
  const ownLinksFrom = ensureOwnLinks(universe)
  const flight: Flight = {
    ticker: handoff.ticker,
    handoff,
    universe,
    ownLinksFrom,
    plan: planCamera(universe, handoff.view),
    startedAt: performance.now(),
    orb,
    orbLabel,
  }
  const palette = readPalette(g)
  const rest = predictedRest(palette)
  const projected: ProjectedNode[] = []
  let idle = 0
  const overlay: Overlay = { canvas, rafId: 0, abandon: 0 }

  const frame = (now: number) => {
    const k = ease(Math.min(1, (now - flight.startedAt) / ARRIVAL_MS))
    const width = document.documentElement.clientWidth, height = window.innerHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
    }
    const x = lerp(handoff.view.x, rest.x, k), y = lerp(handoff.view.y, rest.y, k)
    projectUniverse(universe, viewAt(flight.plan, k, idle, x, y), projected)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, width, height)
    const { veil, labels } = drawUniverseFrame(g, { universe, handoff, ownLinksFrom, projected, k, done: false, width, height, bandBottom: rest.bandBottom, palette })
    // The overlay stands in for the homepage, so it is opaque.
    g.globalCompositeOperation = 'destination-over'
    g.fillStyle = palette.bg
    g.fillRect(0, 0, width, height)
    g.globalCompositeOperation = 'source-over'
    placeOrb(orb, orbLabel, { handoff, k, x, y, rest, palette, veil, labels })
    idle += 0.00026
    overlay.rafId = requestAnimationFrame(frame)
  }
  document.body.append(canvas, orb)
  frame(performance.now())
  // If the ticker page never arrives (a failed navigation), give the page back.
  overlay.abandon = window.setTimeout(discard, ABANDON_MS)
  current = { flight, overlay, release: 0 }
}

/** The flight to this ticker, handed to its page; the overlay stops. */
export function adoptFlight(ticker: string): Flight | null {
  if (!current) return null
  const { flight, overlay } = current
  if (flight.ticker.toUpperCase() !== ticker.toUpperCase()) { discard(); return null }
  window.clearTimeout(current.release)
  if (overlay) {
    cancelAnimationFrame(overlay.rafId)
    window.clearTimeout(overlay.abandon)
    overlay.canvas.remove()
    current.overlay = null
  }
  return flight
}

/**
 * The flight has landed. Its node goes; the flight itself stays claimable
 * for a moment, so a page whose effect runs again at once (React mounts
 * effects twice in development) still knows it arrived by flight.
 */
export function endFlight(flight: Flight) {
  flight.orb.remove()
  releaseFlight(flight)
}

/**
 * The ticker page let go of the flight before landing it. It is dropped
 * shortly after unless the page adopts it again at once (React mounts effects
 * twice in development).
 */
export function releaseFlight(flight: Flight) {
  if (current?.flight !== flight) return
  window.clearTimeout(current.release)
  current.release = window.setTimeout(discard, 1_000)
}
