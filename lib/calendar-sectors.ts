import 'server-only'

import { getMarketNetwork } from '@/lib/network'

const TTL_MS = 60 * 60 * 1000

let cached: { at: number; sectors: Promise<Map<string, string>> } | null = null

/**
 * Sector by symbol for the calendar's sector filter, from the market network the
 * site already reads (`/network`, one call, read once an hour per server instance).
 * The calendar rows carry no sector of their own; a company outside the network
 * has none here and is left out when a sector is chosen. Fails open: without the
 * network the filter is not offered.
 *
 * Founder decision 2026-10-08: build the sector filter in the frontend now rather
 * than wait for `/site/calendar` to carry a sector.
 */
export async function getCalendarSectors(): Promise<Map<string, string> | null> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const sectors = getMarketNetwork().then((graph) => new Map(graph.nodes.flatMap((node) => {
      const symbol = (node.symbol ?? node.ticker).toUpperCase()
      return node.sector ? [[symbol, node.sector] as const, [node.ticker.toUpperCase(), node.sector] as const] : []
    })))
    cached = { at: Date.now(), sectors }
    sectors.catch(() => { if (cached?.sectors === sectors) cached = null })
  }
  try {
    return await cached.sectors
  } catch (error) {
    console.error('[calendar] sectors unavailable', { message: error instanceof Error ? error.message : String(error) })
    return null
  }
}
