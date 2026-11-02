import { normalizeTickerIndexPayload, type CachedTickerIndex } from '@/lib/ticker-search'

let pending: Promise<CachedTickerIndex | null> | null = null

/**
 * The stock picker reads the same ticker index as the site search: loaded once,
 * filtered in the browser, never one request per keystroke or per symbol.
 */
export function loadTickerIndex(): Promise<CachedTickerIndex | null> {
  if (pending) return pending
  pending = fetch('/api/tickers/index', { cache: 'no-store', credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) return null
      return normalizeTickerIndexPayload(await response.json(), response.headers.get('etag'))
    })
    .catch(() => null)
    .then((index) => {
      if (!index) pending = null
      return index
    })
  return pending
}
