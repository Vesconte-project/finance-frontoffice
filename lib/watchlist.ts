import 'server-only'
import { personalRequest } from './personal-server'

export async function getUserWatchlistTickers(): Promise<string[]> {
  const payload = await (await personalRequest('/watchlist')).json() as { tickers: string[] }
  return payload.tickers
}

export async function isTickerInWatchlist(ticker: string): Promise<boolean> {
  return (await getUserWatchlistTickers()).includes(ticker.trim().toUpperCase())
}

export async function addTickerToWatchlist(ticker: string): Promise<{ ok: boolean }> {
  return (await personalRequest('/watchlist', { method: 'POST', body: { ticker: ticker.trim().toUpperCase() } })).json()
}

export async function removeTickerFromWatchlist(ticker: string): Promise<{ ok: boolean }> {
  return (await personalRequest('/watchlist', { method: 'DELETE', body: { ticker: ticker.trim().toUpperCase() } })).json()
}
