/** Display-only reader. All economic comparisons are owned by feature-store. */
export type AnalystConsensus = {
  version: 'analyst_consensus.v1'
  symbol: string
  source: 'yahoo_finance'
  observedAt: string
  providerAsOf: null
  currency: string | null
  targets: { low: number | null; median: number | null; mean: number | null; high: number | null }
  analystOpinionCount: number | null
  recommendation: string | null
  referencePrice: { value: number; currency: string; asOf: string } | null
  /** Fraction supplied by feature-store: median target / reference price - 1. */
  medianUpside: number | null
}

const recommendations: Record<string, string> = {
  strong_buy: 'Strong buy', buy: 'Buy', outperform: 'Outperform', hold: 'Hold',
  underperform: 'Underperform', sell: 'Sell', strong_sell: 'Strong sell',
}
const day = 86_400_000
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const positive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e12 ? value : null
const instant = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const stamp = Date.parse(value)
  return Number.isFinite(stamp) ? stamp : null
}

export function readAnalystConsensus(value: unknown, ticker: string, now = Date.now()): AnalystConsensus | null {
  const doc = object(value)
  if (!doc || doc.version !== 'analyst_consensus.v1' || doc.source !== 'yahoo_finance' || doc.symbol !== ticker) return null
  const observed = instant(doc.observedAt)
  if (observed === null || observed > now || now - observed > 14 * day || doc.providerAsOf !== null) return null
  const raw = object(doc.targets)
  if (!raw) return null
  const currency = typeof doc.currency === 'string' && /^[A-Z]{3}$/.test(doc.currency)
    && !['GBX', 'ILA', 'ZAC', 'XXX'].includes(doc.currency) ? doc.currency : null
  let targets = {
    low: currency ? positive(raw.low) : null, median: currency ? positive(raw.median) : null,
    mean: currency ? positive(raw.mean) : null, high: currency ? positive(raw.high) : null,
  }
  const { low, high } = targets
  if ((low !== null && high !== null && low > high) || [targets.mean, targets.median].some(
    (p) => p !== null && ((low !== null && p < low) || (high !== null && p > high)),
  )) targets = { low: null, median: null, mean: null, high: null }
  const quote = object(doc.referencePrice)
  const quoteValue = positive(quote?.value)
  const quoteTime = instant(quote?.asOf)
  const referencePrice = quote && currency && quote.currency === currency && quoteValue !== null
    && quoteTime !== null && quoteTime <= observed && now - quoteTime <= 7 * day
    ? { value: quoteValue, currency, asOf: String(quote.asOf) } : null
  return {
    version: 'analyst_consensus.v1', symbol: ticker, source: 'yahoo_finance', observedAt: String(doc.observedAt),
    providerAsOf: null, currency, targets,
    analystOpinionCount: typeof doc.analystOpinionCount === 'number' && Number.isInteger(doc.analystOpinionCount)
      && doc.analystOpinionCount > 0 && doc.analystOpinionCount <= 10_000 ? doc.analystOpinionCount : null,
    recommendation: typeof doc.recommendation === 'string' && doc.recommendation in recommendations ? doc.recommendation : null,
    referencePrice, medianUpside: referencePrice && targets.median !== null && typeof doc.medianUpside === 'number'
      && Number.isFinite(doc.medianUpside) ? doc.medianUpside : null,
  }
}

export function recommendationLabel(key: string | null): string | null {
  return key ? recommendations[key] ?? null : null
}

export function analystPrice(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

export function targetDistance(fraction: number): string {
  if (fraction === 0) return 'The median target matches the latest price.'
  const magnitude = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(Math.abs(fraction))
  return `The median target is ${magnitude} ${fraction > 0 ? 'above' : 'below'} the latest price.`
}
