import 'server-only'
import { cache } from 'react'
import { getViewerUserId } from '@/lib/auth'
import { getMarketNetwork } from '@/lib/network'

/** Existing sector lookup stays session-only until the map is replaced (ENG-228). */
export const getCalendarSectors = cache(async (): Promise<Map<string,string> | null> => {
  if (!(await getViewerUserId())) return null
  try {
    const graph=await getMarketNetwork()
    return new Map(graph.nodes.flatMap(node => node.sector ? [
      [(node.symbol ?? node.ticker).toUpperCase(),node.sector] as const,
      [node.ticker.toUpperCase(),node.sector] as const] : []))
  } catch { return null }
})
