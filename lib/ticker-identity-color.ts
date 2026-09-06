const TICKER_IDENTITY_PALETTE = [
  '#3B6FD4',
  '#2A7998',
  '#5A5CC8',
  '#7B4FC8',
  '#9A46B4',
  '#B93F96',
  '#4E6A96',
] as const

export function tickerIdentityColor(ticker: string): string {
  const normalizedTicker = ticker.trim().toUpperCase()
  // FNV-1a keeps the same normalized ticker on the same palette entry across runtimes.
  let hash = 2166136261
  for (let index = 0; index < normalizedTicker.length; index += 1) {
    hash ^= normalizedTicker.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return TICKER_IDENTITY_PALETTE[(hash >>> 0) % TICKER_IDENTITY_PALETTE.length]
}
