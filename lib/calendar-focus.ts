import 'server-only'

import { getViewerUserId } from '@/lib/auth'
import { getAtlasCompany } from '@/lib/atlas'
import { getUserWatchlistTickers } from '@/lib/watchlist'
import type { CalendarFocusQuery } from '@/lib/calendar-model'

export type CalendarFocus =
  | { kind: 'all' }
  | { kind: 'watchlist'; status: 'ok' | 'signed-out' | 'unavailable'; symbols: string[] }
  | {
      kind: 'around'
      center: string
      status: 'ok' | 'signed-out' | 'unavailable'
      /** Related symbols and how each relates to the centre, from the weekly atlas. */
      relations: Record<string, string[]>
    }

/**
 * Which companies the calendar is narrowed to. Both sources are existing reads:
 * the reader's watchlist, and the company's strongest ties on the weekly atlas,
 * the same ones its ticker page shows. Both are read per request with the
 * viewer's verified session.
 */
export async function resolveCalendarFocus(focus: CalendarFocusQuery, signedIn: boolean): Promise<CalendarFocus> {
  if (focus.list === 'watchlist') {
    const userId = await getViewerUserId()
    if (!userId) return { kind: 'watchlist', status: 'signed-out', symbols: [] }
    try {
      return { kind: 'watchlist', status: 'ok', symbols: await getUserWatchlistTickers() }
    } catch (error) {
      console.error('[calendar] watchlist unavailable', { message: error instanceof Error ? error.message : String(error) })
      return { kind: 'watchlist', status: 'unavailable', symbols: [] }
    }
  }
  if (focus.around) {
    const center = focus.around
    // Related companies are an account feature: nothing is read for a signed-out viewer.
    if (!signedIn) return { kind: 'around', center, status: 'signed-out', relations: {} }
    try {
      const atlas = await getAtlasCompany(center)
      // Not on the atlas yet: only the company's own dates, as for an unknown ticker.
      if (atlas.status === 'not_found') return { kind: 'around', center, status: 'ok', relations: {} }
      if (atlas.status !== 'ok') throw new Error(`atlas ${atlas.status}`)
      const relations: Record<string, string[]> = {}
      for (const neighbour of atlas.data.neighbours) {
        if (neighbour.symbol !== center) relations[neighbour.symbol] = ['Moves with it']
      }
      return { kind: 'around', center, status: 'ok', relations }
    } catch (error) {
      console.error('[calendar] atlas ties unavailable', { center, message: error instanceof Error ? error.message : String(error) })
      return { kind: 'around', center, status: 'unavailable', relations: {} }
    }
  }
  return { kind: 'all' }
}

/** The symbols a focus keeps, or null when every company is kept. */
export function focusSymbols(focus: CalendarFocus): Set<string> | null {
  if (focus.kind === 'all') return null
  if (focus.status === 'signed-out') return null
  if (focus.kind === 'watchlist') return new Set(focus.symbols)
  return new Set([focus.center, ...Object.keys(focus.relations)])
}
