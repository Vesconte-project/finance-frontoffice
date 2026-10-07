/*
 * The market universe behind a ticker page: the same kind of 3D network the
 * homepage draws, kept going behind the ticker's identity band.
 *
 * Opening a focused node's full page from the homepage hands the homepage's
 * own network over (offerUniverseHandoff), so the ticker page continues the
 * same world and turns the camera until the node lands on the identity node.
 * A ticker page reached any other way builds its own universe around the
 * ticker (createUniverse).
 */

export type UniverseNode = {
  x: number
  y: number
  z: number
  r: number
  label: string | null
  signal: boolean
  // How much ETF light reaches the node, 1 at an ETF (see HeroConstellation).
  light: number
  // How clearly the homepage's focus mode shows the node, 1 near the focus.
  clar: number
}

export type Universe = {
  nodes: UniverseNode[]
  // Flat index pairs, as the homepage keeps them.
  pairs: number[]
  pairLengths: number[]
  lightReach: number
  R: number
  cam: number
  focus: number
}

/** A camera: rotation, zoom, and where on screen the focused node sits. */
export type UniverseView = {
  ax: number
  ay: number
  zoom: number
  x: number
  y: number
}

export type UniverseHandoff = {
  ticker: string
  universe: Universe
  // The homepage's last frame: viewport coordinates, zoom including focus mode.
  view: UniverseView
  // Line widths in that frame (focus mode draws the field scaled up).
  lineScale: number
  // The homepage's scroll-in progress, which brightens its links.
  progress: number
  createdAt: number
}

const HANDOFF_TTL_MS = 15_000
// A claimed handoff can be claimed again only this briefly, which covers an
// effect that mounts twice (React's development double run) but not a later
// visit to the same ticker.
const RECLAIM_MS = 1_000
let pending: { handoff: UniverseHandoff; claimedAt: number | null } | null = null

export function offerUniverseHandoff(handoff: UniverseHandoff) {
  pending = { handoff, claimedAt: null }
}

/** The pending handoff when it is for this ticker and still fresh. */
export function claimUniverseHandoff(ticker: string, now: number): UniverseHandoff | null {
  if (!pending) return null
  const { handoff, claimedAt } = pending
  if (claimedAt !== null && now - claimedAt > RECLAIM_MS) { pending = null; return null }
  if (handoff.ticker.toUpperCase() !== ticker.toUpperCase()) { pending = null; return null }
  if (now - handoff.createdAt > HANDOFF_TTL_MS || now < handoff.createdAt) { pending = null; return null }
  pending.claimedAt ??= now
  return handoff
}

const ETF_TICKERS = ['VT', 'VEA', 'VWO', 'SPY', 'QQQ', 'GLD']
const HUB_TICKERS = ['ASML', 'NVDA', 'TSM', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSLA', 'GOOGL', 'JPM', 'SONY', 'XOM', 'AVGO', 'AMD', 'LLY', 'V', 'COST', 'NFLX', 'HD']

/** Light along the links from every ETF, by shortest path (as on the homepage). */
export function lightUniverse(nodes: UniverseNode[], pairs: number[], R: number) {
  const adjacency: [number, number][][] = nodes.map(() => [])
  const pairLengths: number[] = []
  for (let k = 0; k < pairs.length; k += 2) {
    const a = nodes[pairs[k]], b = nodes[pairs[k + 1]]
    const length = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
    pairLengths.push(length)
    adjacency[pairs[k]].push([pairs[k + 1], length])
    adjacency[pairs[k + 1]].push([pairs[k], length])
  }
  const travelled = nodes.map((n) => (n.signal ? 0 : Infinity))
  const settled = nodes.map(() => false)
  for (let step = 0; step < nodes.length; step++) {
    let next = -1
    for (let i = 0; i < nodes.length; i++) if (!settled[i] && (next < 0 || travelled[i] < travelled[next])) next = i
    if (next < 0 || travelled[next] === Infinity) break
    settled[next] = true
    for (const [to, length] of adjacency[next]) travelled[to] = Math.min(travelled[to], travelled[next] + length)
  }
  const lightReach = R * 0.27
  nodes.forEach((n, i) => { n.light = Math.exp(-travelled[i] / lightReach) })
  return { pairLengths, lightReach }
}

/** A universe around `ticker`, built the way the homepage builds its own. */
export function createUniverse(ticker: string, width: number, height: number, random: () => number = Math.random): Universe {
  const R = Math.max(width, height) * 0.62
  const symbol = ticker.toUpperCase()
  const hubs = [symbol, ...HUB_TICKERS.filter((t) => t !== symbol && !ETF_TICKERS.includes(t))]
  const nodes: UniverseNode[] = []
  const add = (x: number, y: number, z: number, r: number, label: string | null, signal: boolean) =>
    nodes.push({ x, y, z, r, label, signal, light: 0, clar: 1 }) - 1
  // The ticker sits in front of the centre, so the field opens out behind it.
  const focus = add(-R * 0.18, -R * 0.06, R * 0.32, 3, symbol, ETF_TICKERS.includes(symbol))
  hubs.slice(1).forEach((label, i, all) => {
    const y = 1 - (i / Math.max(1, all.length - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y)), theta = i * 2.399963, rr = R * (0.45 + random() * 0.5)
    add(Math.cos(theta) * ring * rr, y * rr, Math.sin(theta) * ring * rr, 3, label, false)
  })
  ETF_TICKERS.filter((t) => t !== symbol).forEach((label, i) => {
    const angle = (i / ETF_TICKERS.length) * Math.PI * 2 + 0.35
    add(Math.cos(angle) * R * 0.64, Math.sin(angle) * R * 0.43, Math.sin(angle * 2) * R * 0.12, 6, label, true)
  })
  const extra = Math.max(90, Math.floor(width / 12))
  for (let i = 0; i < extra; i++) {
    const theta = random() * 6.283, phi = Math.acos(2 * random() - 1), rr = R * (0.12 + random() * 0.92)
    add(rr * Math.sin(phi) * Math.cos(theta), rr * Math.cos(phi), rr * Math.sin(phi) * Math.sin(theta), 1.1 + random() * 1.3, null, false)
  }
  const pairs: number[] = []
  const threshold = R * 0.34
  const linked = new Set<string>()
  const link = (i: number, j: number) => {
    const key = i < j ? i + ':' + j : j + ':' + i
    if (i === j || linked.has(key)) return
    linked.add(key)
    pairs.push(i, j)
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j]
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < threshold && random() < 0.5 && pairs.length < 1500) link(i, j)
  }
  // The ticker always has a few links of its own to leave the page by.
  nodes
    .map((n, i) => [i, Math.hypot(n.x - nodes[focus].x, n.y - nodes[focus].y, n.z - nodes[focus].z)] as const)
    .filter(([i]) => i !== focus)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 4)
    .forEach(([i]) => link(focus, i))
  const { pairLengths, lightReach } = lightUniverse(nodes, pairs, R)
  return { nodes, pairs, pairLengths, lightReach, R, cam: R * 1.9, focus }
}

/**
 * Gives the focused node at least `min` links of its own, to its nearest
 * nodes. The homepage picks links at random, so its focused node can have
 * none; on the ticker page the node is where the universe starts from.
 * Returns the index in `pairs` where the added links begin.
 */
export function ensureOwnLinks(universe: Universe, min = 3): number {
  const { nodes, pairs, pairLengths, focus } = universe
  const addedFrom = pairs.length
  const linked = new Set<number>()
  for (let k = 0; k < pairs.length; k += 2) {
    if (pairs[k] === focus) linked.add(pairs[k + 1])
    else if (pairs[k + 1] === focus) linked.add(pairs[k])
  }
  if (linked.size >= min) return addedFrom
  const f = nodes[focus]
  nodes
    .map((n, i) => [i, Math.hypot(n.x - f.x, n.y - f.y, n.z - f.z)] as const)
    .filter(([i]) => i !== focus && !linked.has(i))
    .sort((a, b) => a[1] - b[1])
    .slice(0, min - linked.size)
    .forEach(([i, length]) => { pairs.push(focus, i); pairLengths.push(length) })
  return addedFrom
}

export type ProjectedNode = { sx: number; sy: number; s: number; depth: number }

/**
 * Projects every node as the homepage does, then moves the result so the
 * focused node lands on (view.x, view.y): the world turns around the node.
 */
export function projectUniverse(universe: Universe, view: UniverseView, out: ProjectedNode[]) {
  const { nodes, cam, R } = universe
  const cA = Math.cos(view.ax), sA = Math.sin(view.ax), cB = Math.cos(view.ay), sB = Math.sin(view.ay)
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const X0 = n.x * cB - n.z * sB, Z0 = n.x * sB + n.z * cB
    const Y1 = n.y * cA - Z0 * sA, Z1 = n.y * sA + Z0 * cA
    const s = cam / (cam - Z1) * view.zoom
    const p = out[i] ?? (out[i] = { sx: 0, sy: 0, s: 1, depth: 0 })
    p.sx = X0 * s; p.sy = Y1 * s; p.s = s; p.depth = 0.26 + 0.74 * ((Z1 + R) / (2 * R))
  }
  const f = out[universe.focus]
  const ox = view.x - f.sx, oy = view.y - f.sy
  for (let i = 0; i < nodes.length; i++) { out[i].sx += ox; out[i].sy += oy }
  return out
}
