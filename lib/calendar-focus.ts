import 'server-only'

import { getViewerUserId } from '@/lib/auth'
import { getTickerRelationships } from '@/lib/relationships'
import { getUserWatchlistTickers } from '@/lib/watchlist'
import type { CalendarFocusQuery } from '@/lib/calendar-model'

export type CalendarFocus =
  | { kind: 'all' }
  | { kind: 'watchlist'; status: 'ok' | 'signed-out' | 'unavailable'; symbols: string[] }
  | {
      kind: 'around'
      center: string
      status: 'ok' | 'unavailable'
      /** Related symbols and how each relates to the centre, from the relationship atlas. */
      relations: Record<string, string[]>
    }

/**
 * Which companies the calendar is narrowed to. Both sources are existing reads:
 * the reader's watchlist, and the atlas relationships the ticker page shows.
 * Neither is cached across viewers in a way that leaks: the watchlist is read per
 * request with the viewer's own id, and the relationship read is public.
 */
export async function resolveCalendarFocus(focus: CalendarFocusQuery): Promise<CalendarFocus> {
  if (focus.list === 'watchlist') {
    const userId = await getViewerUserId()
    if (!userId) return { kind: 'watchlist', status: 'signed-out', symbols: [] }
    try {
      return { kind: 'watchlist', status: 'ok', symbols: await getUserWatchlistTickers(userId) }
    } catch (error) {
      console.error('[calendar] watchlist unavailable', { message: error instanceof Error ? error.message : String(error) })
      return { kind: 'watchlist', status: 'unavailable', symbols: [] }
    }
  }
  if (focus.around) {
    const center = focus.around
    try {
      const relationships = await getTickerRelationships(center, { topK: 25 })
      const relations: Record<string, string[]> = {}
      const add = (symbol: string, label: string) => {
        if (symbol === center) return
        const labels = relations[symbol] ?? (relations[symbol] = [])
        if (!labels.includes(label)) labels.push(label)
      }
      for (const peer of relationships.themePeers) add(peer.symbol, peer.themes.length ? `Theme: ${peer.themes.slice(0, 2).join(', ')}` : 'Same theme')
      for (const peer of relationships.residualCoMovers) add(peer.symbol, 'Moves with it')
      for (const peer of relationships.marketCoMovers) add(peer.symbol, 'Moves with it')
      for (const peer of relationships.leadLag.leaders) add(peer.symbol, 'Moves before it')
      for (const peer of relationships.leadLag.followers) add(peer.symbol, 'Moves after it')
      return { kind: 'around', center, status: 'ok', relations }
    } catch (error) {
      console.error('[calendar] relationships unavailable', { center, message: error instanceof Error ? error.message : String(error) })
      return { kind: 'around', center, status: 'unavailable', relations: {} }
    }
  }
  return { kind: 'all' }
}

/** The symbols a focus keeps, or null when every company is kept. */
export function focusSymbols(focus: CalendarFocus): Set<string> | null {
  if (focus.kind === 'all') return null
  if (focus.kind === 'watchlist') return new Set(focus.symbols)
  return new Set([focus.center, ...Object.keys(focus.relations)])
}
