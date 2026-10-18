import 'server-only'
import { cache } from 'react'
import { getViewerUserId } from '@/lib/auth'
import { getAtlasOverview } from '@/lib/atlas'

/**
 * The calendar's company grouping: each company's region on the weekly atlas
 * (companies that move together beyond the market). The atlas has no per-company
 * sector, and the old map that supplied one is gone, so the filter groups by region.
 * Signed in only, as before: the full map is a signed-in read.
 */
export const getCalendarSectors = cache(async (): Promise<Map<string, string> | null> => {
  if (!(await getViewerUserId())) return null
  const atlas = await getAtlasOverview(3)
  if (atlas.status !== 'ok') return null
  const labels = new Map(atlas.data.zones.map((zone) => [zone.zoneId, zone.label]))
  return new Map(atlas.data.nodes.flatMap((node) => {
    const label = labels.get(node.zoneId)
    return label ? [[node.symbol.toUpperCase(), label] as const] : []
  }))
})
