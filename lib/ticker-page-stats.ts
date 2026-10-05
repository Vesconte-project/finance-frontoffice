export type CanonicalTickerStatInputs = {
  snapshotProfileMarketCap: number | null | undefined
  fundamentalsMarketCap: number | null | undefined
  quoteMarketCapText: string | null | undefined
  fundamentalsTrailingPe: number | null | undefined
  profileTrailingPe: number | null | undefined
  marketStatsVolume: number | null | undefined
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Select only snapshot/PIT-safe ticker-summary fields for overview cards. Do
 * not substitute latest metadata or fuzzy latest-fundamental matching here:
 * P/E must be canonical or render as —.
 */
export function canonicalTickerStats(input: CanonicalTickerStatInputs) {
  return {
    marketCap: finiteNumber(input.snapshotProfileMarketCap) ?? finiteNumber(input.fundamentalsMarketCap),
    marketCapText: input.quoteMarketCapText ?? null,
    trailingPe: finiteNumber(input.fundamentalsTrailingPe) ?? finiteNumber(input.profileTrailingPe),
    volume: finiteNumber(input.marketStatsVolume),
  }
}

/** A market cap written as text ("$4.98T", "812.4B kr"), as a number; null when it does not read as one. */
export function parseCompactCurrencyNumber(value: string | null): number | null {
  if (!value) return null
  const normalized = value
    .replace(/[$€£₹¥]/g, '')
    .replace(/\b(?:USD|EUR|GBP|GBp|GBX|AUD|HKD|INR|JPY|DKK|SEK|NOK|kr)\b/gi, '')
    .replace(/,/g, '')
    .trim()
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/i)
  if (!match) return null

  const numeric = Number(match[1])
  if (!Number.isFinite(numeric)) return null

  const suffix = match[2]?.toUpperCase()
  if (suffix === 'T') return numeric * 1_000_000_000_000
  if (suffix === 'B') return numeric * 1_000_000_000
  if (suffix === 'M') return numeric * 1_000_000
  if (suffix === 'K') return numeric * 1_000
  return numeric
}

/**
 * The market cap every tab shows (Spec PRD-78, "Os mesmos números em todas as
 * tabs"): the snapshot's figure, else the quote's, as the Overview reads it.
 */
export function tickerMarketCap(summary: {
  profile?: { marketCap?: number | null } | null
  fundamentalsSummary?: { marketCap?: number | null } | null
  quote?: { marketCapText?: string | null } | null
}): number | null {
  const stats = canonicalTickerStats({
    snapshotProfileMarketCap: summary.profile?.marketCap,
    fundamentalsMarketCap: summary.fundamentalsSummary?.marketCap,
    quoteMarketCapText: summary.quote?.marketCapText,
    fundamentalsTrailingPe: null,
    profileTrailingPe: null,
    marketStatsVolume: null,
  })
  return stats.marketCap ?? parseCompactCurrencyNumber(stats.marketCapText)
}
