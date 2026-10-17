import { fetchBackendJson } from './backend'

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

export async function getUserWatchlistTickers(userId: string): Promise<string[]> {
  const payload = await fetchBackendJson<{ tickers?: string[] }>(
    `/site/watchlist?user_id=${encodeURIComponent(userId)}`,
    { context: 'backend.site.watchlist.read' }
  )
  return Array.isArray(payload?.tickers)
    ? payload!.tickers.map((ticker) => normalizeTicker(ticker)).filter(Boolean)
    : []
}

export async function isTickerInWatchlist(userId: string, ticker: string): Promise<boolean> {
  const tickers = await getUserWatchlistTickers(userId)
  return tickers.includes(normalizeTicker(ticker))
}

export async function addTickerToWatchlist(userId: string, ticker: string): Promise<{ ok: boolean; error?: string }> {
  const payload = await fetchBackendJson<{ ok?: boolean; error?: string }>('/site/watchlist', {
    context: 'backend.site.watchlist.add',
    init: {
      method: 'POST',
      body: JSON.stringify({ userId, ticker: normalizeTicker(ticker) }),
    },
  })
  if (!payload?.ok) return { ok: false, error: payload?.error || 'Failed to add ticker.' }
  return { ok: true }
}

export async function removeTickerFromWatchlist(userId: string, ticker: string): Promise<{ ok: boolean; error?: string }> {
  const payload = await fetchBackendJson<{ ok?: boolean; error?: string }>('/site/watchlist', {
    context: 'backend.site.watchlist.remove',
    init: {
      method: 'DELETE',
      body: JSON.stringify({ userId, ticker: normalizeTicker(ticker) }),
    },
  })
  if (!payload?.ok) return { ok: false, error: payload?.error || 'Failed to remove ticker.' }
  return { ok: true }
}
