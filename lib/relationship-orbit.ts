/**
 * Geometry of a company's relationship orbit: the company at the centre, the
 * regions its strongest ties land in as sectors around it, and each tie as a
 * ball inside its region's sector, closer to the centre the stronger the tie.
 *
 * Only the backend's answer is drawn. A tie the reader may not see is never
 * placed by its region or strength: hidden ties share one locked sector, built
 * from their count alone, outside the weakest visible tie (they are weaker by
 * definition, because the visible ones are the strongest).
 */
import type { PlotBox } from './chart-labels'

export type OrbitTie = { symbol: string; zoneId: string | null; correlation: number }

export type OrbitInput = {
  /** The company's own region; its sector comes first, at the top. */
  zoneId: string
  ties: readonly OrbitTie[]
  /** Ties that exist but are not sent to this reader. */
  hidden: number
  /** Regions by the share of the company's ties, largest first; orders the other sectors. */
  zoneOrder?: readonly string[]
}

export type OrbitGeometry = {
  box: PlotBox
  centre: { x: number; y: number }
  /** Radius of the company's own ball. */
  core: number
  /** Inner and outer radius of the sector band. */
  inner: number
  outer: number
  sectors: OrbitSector[]
  nodes: OrbitNode[]
  ghosts: OrbitGhost[]
  /** Guide rings with the correlation each one marks. */
  rings: Array<{ radius: number; value: number; labelled: boolean }>
  /** Direction of the ring values: the gap before the company's own region, where no tie is drawn. */
  ringAngle: number
}

export type OrbitSector = {
  /** A region id, or null for the locked sector. */
  zoneId: string | null
  /** Angles in radians, clockwise from the positive x axis (screen space). */
  start: number
  end: number
  path: string
  /** The band's outer edge, drawn as the region's coastline. */
  arc: string
  /** Where the sector's name goes, just outside the band. */
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
  /** Middle of the band, for an overlay control. */
  middle: { x: number; y: number }
}

export type OrbitNode = OrbitTie & {
  x: number
  y: number
  /** Direction from the centre, in radians; the ticker is written beyond the ball along it. */
  angle: number
  /** How strong the tie is drawn, 0–1 on the fixed scale (`orbitStrength`). */
  strength: number
  radius: number
  /** Where the line from the centre starts, at the edge of the company's ball. */
  from: { x: number; y: number }
}

export type OrbitGhost = { x: number; y: number; radius: number }

export const WIDE_BOX: PlotBox = { width: 1000, height: 600 }
export const COMPACT_BOX: PlotBox = { width: 600, height: 640 }

/** Gap between sectors, in radians. */
const GAP = 0.05
/** The smallest sector, in radians, so a single tie still has room for its name. */
const MIN_SPAN = 0.42
const TOP = -Math.PI / 2

function point(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

const round = (value: number) => Math.round(value * 10) / 10

/** An annular sector as an SVG path. */
export function sectorPath(cx: number, cy: number, inner: number, outer: number, start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0
  const a = point(cx, cy, outer, start)
  const b = point(cx, cy, outer, end)
  const c = point(cx, cy, inner, end)
  const d = point(cx, cy, inner, start)
  return [
    `M ${round(a.x)} ${round(a.y)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${round(b.x)} ${round(b.y)}`,
    `L ${round(c.x)} ${round(c.y)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${round(d.x)} ${round(d.y)}`,
    'Z',
  ].join(' ')
}

/** An arc of a circle as an SVG path. */
export function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const a = point(cx, cy, radius, start)
  const b = point(cx, cy, radius, end)
  return `M ${round(a.x)} ${round(a.y)} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${round(b.x)} ${round(b.y)}`
}

function anchorFor(angle: number): 'start' | 'middle' | 'end' {
  const cos = Math.cos(angle)
  if (cos > 0.25) return 'start'
  if (cos < -0.25) return 'end'
  return 'middle'
}

/**
 * How far from the company a tie sits, on one fixed scale for every company:
 * 0 at a correlation of 1, 1 at 0. The square root gives the weak ties, where
 * most of them are, more room, so 0.15 and 0.25 stay apart while a page whose
 * ties are all weak still draws them all far out.
 */
export function orbitReach(correlation: number): number {
  const value = Number.isFinite(correlation) ? Math.max(0, Math.min(1, correlation)) : 0
  return 1 - Math.sqrt(value)
}

/** How strong a tie is drawn (line width, opacity, ball size), on the same fixed scale: full from 0.6. */
export function orbitStrength(correlation: number): number {
  return Number.isFinite(correlation) ? Math.max(0, Math.min(1, correlation / 0.6)) : 0
}

/** The guide rings, the same on every page. */
export const ORBIT_RINGS = [0.5, 0.25, 0.1] as const

type Group = { zoneId: string | null; ties: OrbitTie[]; units: number; weight: number }

/** The locked sector's share against the visible ties: about a third of the circle, whatever the hidden count. */
const LOCKED_WEIGHT = 0.45

function groups(input: OrbitInput): Group[] {
  const byZone = new Map<string, OrbitTie[]>()
  for (const tie of input.ties) {
    const key = tie.zoneId ?? ''
    byZone.set(key, [...(byZone.get(key) ?? []), tie])
  }
  const order = input.zoneOrder ?? []
  const rank = (zoneId: string) => {
    if (zoneId === input.zoneId) return -1
    const index = order.indexOf(zoneId)
    return index === -1 ? order.length : index
  }
  const zones = [...byZone.keys()].sort((a, b) =>
    rank(a) - rank(b) || (byZone.get(b)?.length ?? 0) - (byZone.get(a)?.length ?? 0) || a.localeCompare(b))
  const result: Group[] = zones.map((zoneId) => ({
    zoneId: zoneId || null,
    ties: [...(byZone.get(zoneId) ?? [])].sort((a, b) => b.correlation - a.correlation || a.symbol.localeCompare(b.symbol)),
    units: byZone.get(zoneId)?.length ?? 0,
    weight: byZone.get(zoneId)?.length ?? 0,
  }))
  if (input.hidden > 0) {
    // Its size never says how many are hidden beyond the count written on it.
    result.push({ zoneId: null, ties: [], units: input.hidden, weight: Math.max(1, input.ties.length * LOCKED_WEIGHT) })
  }
  return result
}

/** Spread sector angles over the circle in proportion to their weight, with a floor. */
function spans(units: readonly number[]): number[] {
  const count = units.length
  if (!count) return []
  const free = Math.PI * 2 - GAP * count
  const total = units.reduce((sum, value) => sum + value, 0) || 1
  let result = units.map((value) => (value / total) * free)
  const small = result.map((span) => span < MIN_SPAN)
  const fixed = small.filter(Boolean).length * MIN_SPAN
  const rest = units.reduce((sum, value, index) => sum + (small[index] ? 0 : value), 0)
  if (fixed > 0 && fixed < free && rest > 0) {
    result = units.map((value, index) => (small[index] ? MIN_SPAN : (value / rest) * (free - fixed)))
  }
  return result
}

/** Slots of a sector from its middle outwards, alternating sides: the strongest tie takes the middle. */
export function centreOut(count: number): number[] {
  const middle = Math.floor((count - 1) / 2)
  const order: number[] = []
  for (let step = 0; order.length < count; step += 1) {
    for (const slot of step === 0 ? [middle] : [middle + step, middle - step]) {
      if (slot >= 0 && slot < count && order.length < count) order.push(slot)
    }
  }
  return order
}

/** A deterministic scatter for hidden ties: a function of their count and index only. */
function ghostSpot(index: number, count: number, start: number, end: number, from: number, to: number) {
  const t = (index + 0.5) / count
  const wobble = ((index * 7919) % 13) / 13
  const row = index % 2 ? 0.62 + 0.3 * wobble : 0.08 + 0.3 * wobble
  return { angle: start + (end - start) * (0.12 + 0.76 * t), radius: from + (to - from) * row }
}

export function orbitGeometry(input: OrbitInput, box: PlotBox): OrbitGeometry {
  const centre = { x: box.width / 2, y: box.height / 2 }
  const compact = box.width < 800
  const outer = Math.min(box.width, box.height) / 2 - (compact ? 74 : 70)
  const core = compact ? 18 : 20
  const inner = core + (compact ? 26 : 34)
  // One fixed scale: the same distance always means the same correlation, on every page.
  const near = inner + 6
  const far = outer - 8
  const radiusOf = (value: number) => near + orbitReach(value) * (far - near)
  // Hidden ties are weaker than every visible one, so they sit outside the weakest visible tie.
  const weakest = input.ties.length ? Math.max(...input.ties.map((tie) => radiusOf(tie.correlation))) : near
  const ghostFrom = Math.min(weakest + 12, outer - 22)
  const ghostTo = outer - 6
  const ordered = groups(input)
  const widths = spans(ordered.map((group) => group.weight))
  let cursor = TOP - (widths[0] ?? 0) / 2
  const sectors: OrbitSector[] = []
  const nodes: OrbitNode[] = []
  const ghosts: OrbitGhost[] = []
  ordered.forEach((group, index) => {
    const start = cursor
    const end = cursor + (widths[index] ?? 0)
    cursor = end + GAP
    const mid = (start + end) / 2
    const labelAt = point(centre.x, centre.y, outer + (compact ? 16 : 20), mid)
    sectors.push({
      zoneId: group.zoneId,
      start,
      end,
      path: sectorPath(centre.x, centre.y, inner, outer, start, end),
      arc: arcPath(centre.x, centre.y, outer, start, end),
      label: { x: round(labelAt.x), y: round(labelAt.y), anchor: anchorFor(mid) },
      middle: (() => {
        const at = point(centre.x, centre.y, group.ties.length ? (inner + outer) / 2 : (ghostFrom + ghostTo) / 2, mid)
        return { x: round(at.x), y: round(at.y) }
      })(),
    })
    if (!group.ties.length) {
      for (let ghost = 0; ghost < group.units; ghost += 1) {
        const spot = ghostSpot(ghost, group.units, start, end, ghostFrom, ghostTo)
        const at = point(centre.x, centre.y, spot.radius, spot.angle)
        ghosts.push({ x: round(at.x), y: round(at.y), radius: compact ? 5 : 6 })
      }
      return
    }
    const count = group.ties.length
    const slots = centreOut(count)
    group.ties.forEach((tie, rank) => {
      const slot = slots[rank] ?? rank
      const angle = start + (end - start) * ((slot + 0.5) / count)
      const radius = radiusOf(tie.correlation)
      const at = point(centre.x, centre.y, radius, angle)
      const strength = orbitStrength(tie.correlation)
      const ball = (compact ? 6 : 7) + strength * (compact ? 4 : 5)
      const from = point(centre.x, centre.y, core + 4, angle)
      nodes.push({
        ...tie,
        x: round(at.x),
        y: round(at.y),
        angle,
        strength,
        radius: round(ball),
        from: { x: round(from.x), y: round(from.y) },
      })
    })
  })
  // On a phone the rings sit close together: the middle one keeps its circle but not its number.
  const rings = ORBIT_RINGS.map((value) => ({ radius: round(radiusOf(value)), value, labelled: !compact || value !== 0.25 }))
  const ringAngle = (sectors[0]?.start ?? TOP) - GAP / 2
  return { box, centre, core, inner, outer, sectors, nodes, ghosts, rings, ringAngle }
}
