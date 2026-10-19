/**
 * Pure logic for the atlas's Browse tabs, region and company panels and the
 * region tooltip (pro-spec §9, prototype v27): only what the payload carries,
 * so a field the tier does not receive leaves its line out. Unit-tested.
 */
import type { AtlasBundle, AtlasContour, AtlasLabelSource, AtlasMembership, AtlasZone } from './atlas-model'
import type { AtlasMove } from './atlas-pro-model'

export const percent = (value: number) => `${Math.round(value * 100)}%`

/**
 * How tightly each region's companies move together, as 1–5 dots: the rank
 * of its cohesion among the regions with more than one company. Regions
 * without a cohesion (signed out) get none.
 */
export function cohesionDots(zones: readonly AtlasZone[]): Map<string, number> {
  const live = zones.filter((zone) => zone.cohesion !== null && zone.memberCount > 1).map((zone) => zone.cohesion as number).sort((a, b) => a - b)
  const dots = new Map<string, number>()
  if (!live.length) return dots
  for (const zone of zones) {
    if (zone.cohesion === null) continue
    const rank = live.filter((value) => value <= (zone.cohesion as number)).length / live.length
    dots.set(zone.zoneId, Math.max(1, Math.ceil(rank * 5)))
  }
  return dots
}

export type RegionChange = { joined: number; left: number }

/** Companies that moved in or out of each region: the flagged moves of a movement answer. */
export function regionChanges(moves: readonly AtlasMove[]): Map<string, RegionChange> {
  const changes = new Map<string, RegionChange>()
  const at = (zoneId: string) => changes.get(zoneId) ?? changes.set(zoneId, { joined: 0, left: 0 }).get(zoneId) as RegionChange
  for (const move of moves) {
    if (!move.flow || move.fromZoneId === move.toZoneId) continue
    at(move.toZoneId).joined += 1
    at(move.fromZoneId).left += 1
  }
  return changes
}

export type RegionSort = 'size' | 'value' | 'tight' | 'change'
export type RegionRow = { zone: AtlasZone; leaders: string[]; dots: number | null; change: RegionChange | null }

/** Browse › Regions: the regions matching a filter (name or a lead ticker), in the chosen order. */
export function browseRegions(
  zones: readonly AtlasZone[],
  leadersOf: (zone: AtlasZone) => string[],
  options: { term?: string; sort?: RegionSort; dots?: ReadonlyMap<string, number>; changes?: ReadonlyMap<string, RegionChange> | null } = {},
): RegionRow[] {
  const term = (options.term ?? '').trim().toLowerCase()
  const rows = zones
    .filter((zone) => zone.memberCount > 0)
    .map((zone) => ({
      zone,
      leaders: leadersOf(zone).slice(0, 4),
      dots: options.dots?.get(zone.zoneId) ?? null,
      change: options.changes ? options.changes.get(zone.zoneId) ?? { joined: 0, left: 0 } : null,
    }))
    .filter((row) => !term || row.zone.label.toLowerCase().replace(/_/g, ' ').includes(term) || row.leaders.some((symbol) => symbol.toLowerCase().includes(term)))
  const key: Record<RegionSort, (row: RegionRow) => number> = {
    size: (row) => row.zone.memberCount,
    value: (row) => row.zone.totalMarketCap ?? -1,
    tight: (row) => row.zone.cohesion ?? -2,
    change: (row) => (row.change ? row.change.joined + row.change.left : -1),
  }
  const by = key[options.sort ?? 'size']
  return rows.sort((a, b) => by(b) - by(a) || b.zone.memberCount - a.zone.memberCount || a.zone.label.localeCompare(b.zone.label))
}

/** Browse › Links: the region pairs with the most strong ties between them. */
export function topLinks(bundles: readonly AtlasBundle[], limit = 15): AtlasBundle[] {
  return [...bundles]
    .filter((bundle) => bundle.tieCount > 0 && bundle.zoneA !== bundle.zoneB)
    .sort((a, b) => b.tieCount - a.tieCount || (a.zoneA + a.zoneB).localeCompare(b.zoneA + b.zoneB))
    .slice(0, limit)
}

/** "38 ties · 0.31", or only the count when the average is not served (signed out). */
export function linkText(tieCount: number, meanCorrelation: number | null): string {
  return meanCorrelation === null ? `${tieCount} ties` : `${tieCount} ties · ${meanCorrelation.toFixed(2)}`
}

/** The region panel's naming note, when the source and its share are known. */
export function namingNote(source: AtlasLabelSource | null, label: string, support: number | null): string | null {
  if (!source || support === null) return null
  return `Named after the ${source} "${label.replace(/_/g, ' ')}", which ${percent(support)} of its companies share. The name is a guide; the region itself comes from prices.`
}

/** The v18 tooltip line on a region: what its name comes from. */
export function nameSourceLine(source: AtlasLabelSource | null, support: number | null): string | null {
  return source && support !== null ? `Named after the ${source} most of them share (${percent(support)})` : null
}

/** How much of a region's weight its outline holds (80% unless the contour says). */
export function coverageOf(contour: AtlasContour | null): number {
  return contour?.type === 'rings' && contour.coverage > 0 && contour.coverage <= 1 ? contour.coverage : 0.8
}

/** A company between regions: more than one region, and at least 15% of its ties outside the main one. */
export function betweenRegions(memberships: readonly AtlasMembership[]): boolean {
  const [main] = memberships
  return memberships.length > 1 && main !== undefined && 1 - main.share >= 0.15
}

/** "Moves with others": its reach against the strongest company on the map, as a percentage. */
export function movesWithOthers(reach: number | null, maxReach: number | null): string | null {
  if (reach === null || maxReach === null || maxReach <= 0) return null
  return percent(Math.max(0, Math.min(1, reach / maxReach)))
}
